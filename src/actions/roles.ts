"use server";

import { revalidatePath } from "next/cache";

import { revalidateDashboardRolesData } from "@/lib/dashboard-cache/tags";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { resolveActionOrgContext } from "@/lib/auth/action-context";
import { getDb } from "@/db";
import {
  canManageAdminRole,
  getPermissionCodesForUser,
} from "@/lib/permissions";
import { permissions, role_permissions, roles } from "@/db/schema";

export type RoleActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function roleBelongsToOrg(
  roleId: string,
  organizationId: string,
): Promise<{
  id: string;
  is_system: boolean;
  name: string;
  slug: string | null;
} | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: roles.id,
      is_system: roles.is_system,
      name: roles.name,
      slug: roles.slug,
    })
    .from(roles)
    .where(
      and(eq(roles.id, roleId), eq(roles.organization_id, organizationId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Create a role or update name + permissions in one step (modal). */
export async function saveRoleModalAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Not signed in." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "No organization for your profile." };
  }
  const { userId, organizationId: orgId } = ctx;

  const roleIdRaw = String(formData.get("roleId") ?? "").trim();

  const userCodes = await getPermissionCodesForUser(userId);
  const canManageRoles = userCodes.has("roles:manage");
  const canAssignPermissions = userCodes.has("permissions:assign");

  if (!roleIdRaw) {
    if (!canManageRoles) {
      return {
        ok: false,
        error: "You need roles:manage to create roles.",
      };
    }
  }

  const name = z
    .string()
    .min(1, "Name is required")
    .max(120)
    .safeParse(String(formData.get("name") ?? "").trim());
  if (!name.success) {
    return { ok: false, error: name.error.issues[0]?.message ?? "Invalid name" };
  }

  const permissionIds = formData
    .getAll("permissionId")
    .map((v) => String(v))
    .filter(Boolean);

  const db = getDb();

  const valid = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions);
  const allowed = new Set(valid.map((p) => p.id));
  const safeIds = permissionIds.filter((id) => allowed.has(id));

  if (!canManageAdminRole(userCodes)) {
    const adminOnlyIds = new Set(
      valid.filter((p) => p.code.startsWith("admin:")).map((p) => p.id),
    );
    if (safeIds.some((id) => adminOnlyIds.has(id))) {
      return {
        ok: false,
        error: "You cannot assign administrator-only permissions.",
      };
    }
  }

  if (!roleIdRaw) {
    let createdId: string | null = null;
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(roles)
        .values({
          organization_id: orgId,
          name: name.data,
          is_system: false,
        })
        .returning({ id: roles.id });
      const created = inserted[0];
      if (!created) return;
      createdId = created.id;
      if (safeIds.length > 0) {
        await tx.insert(role_permissions).values(
          safeIds.map((permission_id) => ({
            role_id: created.id,
            permission_id,
          })),
        );
      }
    });

    if (!createdId) {
      return { ok: false, error: "Could not create role." };
    }

    revalidateDashboardRolesData(orgId);
    revalidatePath("/roles");
    return { ok: true, message: "Role created." };
  }

  const row = await roleBelongsToOrg(roleIdRaw, orgId);
  if (!row) return { ok: false, error: "Role not found." };

  if (!canManageRoles && !canAssignPermissions) {
    return {
      ok: false,
      error: "You need roles:manage or permissions:assign to edit roles.",
    };
  }

  if (!canManageRoles && canAssignPermissions && !row.is_system) {
    if (name.data !== row.name) {
      return {
        ok: false,
        error: "Only role managers can rename custom roles.",
      };
    }
  }

  if (row.slug === "admin" && !canManageAdminRole(userCodes)) {
    return {
      ok: false,
      error: "Only administrators can change the Admin role.",
    };
  }

  if (row.is_system && name.data !== row.name) {
    return { ok: false, error: "System roles cannot be renamed." };
  }

  await db.transaction(async (tx) => {
    if (!row.is_system) {
      await tx
        .update(roles)
        .set({ name: name.data })
        .where(eq(roles.id, roleIdRaw));
    }

    await tx
      .delete(role_permissions)
      .where(eq(role_permissions.role_id, roleIdRaw));
    if (safeIds.length > 0) {
      await tx.insert(role_permissions).values(
        safeIds.map((permission_id) => ({
          role_id: roleIdRaw,
          permission_id,
        })),
      );
    }
  });

  revalidateDashboardRolesData(orgId);
  revalidatePath("/roles");
  return { ok: true, message: "Role updated." };
}

export async function deleteRoleAction(
  _prev: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  const ctx = await resolveActionOrgContext();
  if (ctx.kind === "anon") return { ok: false, error: "Not signed in." };
  if (ctx.kind === "no_org") {
    return { ok: false, error: "No organization for your profile." };
  }
  const { userId, organizationId: orgId } = ctx;

  const delPerm = await getPermissionCodesForUser(userId);
  if (!delPerm.has("roles:manage")) {
    return {
      ok: false,
      error: "You need roles:manage to delete roles.",
    };
  }

  const roleId = String(formData.get("roleId") ?? "");
  const row = await roleBelongsToOrg(roleId, orgId);
  if (!row) return { ok: false, error: "Role not found." };
  if (row.slug === "owner" || row.slug === "admin") {
    return { ok: false, error: "This role cannot be deleted." };
  }
  if (row.is_system) {
    return { ok: false, error: "System roles cannot be deleted." };
  }

  const db = getDb();
  await db.delete(roles).where(eq(roles.id, roleId));

  revalidateDashboardRolesData(orgId);
  revalidatePath("/roles");
  return { ok: true, message: "Role deleted." };
}

