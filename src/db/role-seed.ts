import { eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { permissions, role_permissions, roles } from "@/db/schema";
import { syncBillingPlans } from "@/lib/billing/plans";

/** See the hidden Admin role and admin-only permission codes in the UI. */
export const PERMISSION_CODE_ADMIN_VIEW = "admin:roles:view";
/** Edit the Admin role and admin-only permissions. */
export const PERMISSION_CODE_ADMIN_MANAGE = "admin:roles:manage";
/** Assign the Admin role to members. */
export const PERMISSION_CODE_ADMIN_ASSIGN = "admin:assign";

export const ADMIN_ONLY_PERMISSION_CODES = [
  PERMISSION_CODE_ADMIN_VIEW,
  PERMISSION_CODE_ADMIN_MANAGE,
  PERMISSION_CODE_ADMIN_ASSIGN,
] as const;

const ADMIN_ONLY_SET = new Set<string>(ADMIN_ONLY_PERMISSION_CODES);

/** Global permission catalog (synced into `permissions` via `syncGlobalPermissions`). */
export const ALL_PERMISSION_DEFINITIONS: { code: string; description: string }[] =
  [
    {
      code: PERMISSION_CODE_ADMIN_VIEW,
      description:
        "View the hidden Admin role and administrator-only permission codes",
    },
    {
      code: PERMISSION_CODE_ADMIN_MANAGE,
      description: "Edit the Admin role and administrator-only permissions",
    },
    {
      code: PERMISSION_CODE_ADMIN_ASSIGN,
      description: "Assign the Admin role to organization members",
    },
    {
      code: "organization:read",
      description: "View organization profile",
    },
    {
      code: "organization:update",
      description: "Edit organization profile",
    },
    {
      code: "organizations:create",
      description: "Create a new organization/workspace",
    },
    {
      code: "organizations:switch",
      description: "Switch active organization/workspace",
    },
    {
      code: "members:read",
      description: "View organization members",
    },
    {
      code: "members:invite",
      description: "Invite new members",
    },
    {
      code: "members:remove",
      description: "Remove members from the organization",
    },
    {
      code: "roles:read",
      description: "View roles and their permissions",
    },
    {
      code: "roles:manage",
      description: "Create and edit custom roles",
    },
    {
      code: "permissions:assign",
      description: "Change permission assignments on roles",
    },
    {
      code: "properties:create",
      description: "Create properties",
    },
    {
      code: "properties:read",
      description: "View properties",
    },
    {
      code: "properties:update",
      description: "Edit properties",
    },
    {
      code: "properties:delete",
      description: "Delete properties",
    },
    {
      code: "deals:read",
      description: "View deals list, details, and dashboard deal stats",
    },
    {
      code: "deals:create",
      description: "Create deals",
    },
    {
      code: "deals:update",
      description: "Edit deals, change status, attach or replace files",
    },
    {
      code: "deals:delete",
      description: "Delete deals",
    },
    {
      code: "projects:read",
      description: "View projects",
    },
    {
      code: "projects:manage",
      description: "Create and rename projects",
    },
    {
      code: "billing:read",
      description: "View billing",
    },
    {
      code: "billing:manage",
      description: "Manage billing and subscriptions",
    },
  ];

/** Default permissions for the Manager role (editable in the UI). */
export const MANAGER_DEFAULT_PERMISSION_CODES = [
  "organization:read",
  "organizations:switch",
  "members:read",
  "members:invite",
  "roles:read",
  "properties:create",
  "properties:read",
  "properties:update",
  "deals:read",
  "deals:create",
  "deals:update",
  "projects:read",
  "projects:manage",
  "billing:read",
] as const;

export async function syncGlobalPermissions(): Promise<void> {
  const db = getDb();
  for (const def of ALL_PERMISSION_DEFINITIONS) {
    await db
      .insert(permissions)
      .values(def)
      .onConflictDoNothing({ target: permissions.code });
  }
}

/** Idempotent: billing `plans` rows + global `permissions` catalog (no org roles). */
export async function syncGlobalReferenceData(): Promise<void> {
  await syncBillingPlans();
  await syncGlobalPermissions();
}

export async function syncOrgStandardRolePermissions(
  organizationId: string,
): Promise<void> {
  const db = getDb();

  const permRows = await db
    .select({ id: permissions.id, code: permissions.code })
    .from(permissions);

  const codeToId = new Map(permRows.map((p) => [p.code, p.id]));

  const roleRows = await db
    .select({ id: roles.id, slug: roles.slug })
    .from(roles)
    .where(eq(roles.organization_id, organizationId));

  const bySlug = new Map<string, string>();
  for (const r of roleRows) {
    if (r.slug) bySlug.set(r.slug, r.id);
  }

  const adminId = bySlug.get("admin");
  const ownerId = bySlug.get("owner");
  const managerId = bySlug.get("manager");

  const allIds = ALL_PERMISSION_DEFINITIONS.map((d) => codeToId.get(d.code)).filter(
    (id): id is string => Boolean(id),
  );

  const ownerIds = ALL_PERMISSION_DEFINITIONS.filter(
    (d) => !ADMIN_ONLY_SET.has(d.code),
  )
    .map((d) => codeToId.get(d.code))
    .filter((id): id is string => Boolean(id));

  const managerIds = MANAGER_DEFAULT_PERMISSION_CODES.map((c) =>
    codeToId.get(c),
  ).filter((id): id is string => Boolean(id));

  await db.transaction(async (tx) => {
    const standardRoleIds = [adminId, ownerId, managerId].filter(
      (id): id is string => Boolean(id),
    );
    if (standardRoleIds.length > 0) {
      await tx
        .delete(role_permissions)
        .where(inArray(role_permissions.role_id, standardRoleIds));
    }

    async function link(roleId: string | undefined, ids: string[]) {
      if (!roleId || ids.length === 0) return;
      await tx.insert(role_permissions).values(
        ids.map((permission_id) => ({ role_id: roleId, permission_id })),
      );
    }

    await link(adminId, allIds);
    await link(ownerId, ownerIds);
    await link(managerId, managerIds);
  });
}
