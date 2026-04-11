"use server";

import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { revalidateAllDashboardForOrganization } from "@/lib/dashboard-cache/tags";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth";
import { getFreePlanId } from "@/lib/billing/plans";
import { getPermissionCodesForUser } from "@/lib/permissions";
import { getDb } from "@/db";
import {
  organization_memberships,
  organizations,
  profiles,
  roles,
} from "@/db/schema";
import {
  syncGlobalReferenceData,
  syncOrgStandardRolePermissions,
} from "@/db/role-seed";
import { insertDefaultProjectForOrganization } from "@/lib/projects/org-projects";

export type OrganizationActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

const createOrgSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required").max(120),
});

export async function createOrganizationAction(
  _prev: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = createOrgSchema.safeParse({
    organizationName: String(formData.get("organizationName") ?? "").trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid organization name",
    };
  }

  const db = getDb();
  const [profile] = await db
    .select({
      fullName: profiles.full_name,
      avatarUrl: profiles.avatar_url,
      organizationId: profiles.organization_id,
      mayCreateOwnOrganization: profiles.may_create_own_organization,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (!profile) return { ok: false, error: "Profile not found." };

  if (!profile.mayCreateOwnOrganization) {
    return {
      ok: false,
      error:
        "Only invited members who have not created their own organization yet can add one.",
    };
  }

  await syncGlobalReferenceData();
  const organizationId = randomUUID();
  const ownerRoleId = randomUUID();
  const adminRoleId = randomUUID();
  const managerRoleId = randomUUID();
  const freePlanId = await getFreePlanId();
  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: organizationId,
      name: parsed.data.organizationName,
      plan_id: freePlanId,
    });

    await insertDefaultProjectForOrganization(tx, organizationId);

    await tx.insert(roles).values([
      {
        id: adminRoleId,
        organization_id: organizationId,
        name: "Admin",
        is_system: true,
        slug: "admin",
      },
      {
        id: managerRoleId,
        organization_id: organizationId,
        name: "Manager",
        is_system: false,
        slug: "manager",
      },
      {
        id: ownerRoleId,
        organization_id: organizationId,
        name: "Owner",
        is_system: true,
        slug: "owner",
      },
    ]);
  });

  await syncOrgStandardRolePermissions(organizationId);

  await db
    .insert(organization_memberships)
    .values({
      user_id: user.id,
      organization_id: organizationId,
      role_id: ownerRoleId,
    })
    .onConflictDoNothing({
      target: [
        organization_memberships.user_id,
        organization_memberships.organization_id,
      ],
    });

  await db
    .update(profiles)
    .set({
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      organization_id: organizationId,
      role_id: ownerRoleId,
      may_create_own_organization: false,
    })
    .where(eq(profiles.id, user.id));

  revalidateAllDashboardForOrganization(organizationId);
  revalidatePath("/organization");
  revalidatePath("/dashboard");
  revalidatePath("/roles");
  revalidatePath("/billing");
  return { ok: true, message: "Organization created and switched." };
}

export async function switchOrganizationAction(
  _prev: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const parsed = z
    .string()
    .uuid("Invalid organization")
    .safeParse(String(formData.get("organizationId") ?? "").trim());
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid organization" };
  }

  const permissionCodes = await getPermissionCodesForUser(user.id);
  const db = getDb();
  const [activeRole] = await db
    .select({ slug: roles.slug })
    .from(profiles)
    .leftJoin(roles, eq(profiles.role_id, roles.id))
    .where(eq(profiles.id, user.id))
    .limit(1);
  const hasSwitchPerm =
    permissionCodes.has("organizations:switch") ||
    activeRole?.slug === "owner" ||
    activeRole?.slug === "admin";
  if (!hasSwitchPerm) {
    return { ok: false, error: "You don’t have permission to switch organizations." };
  }

  const [membership] = await db
    .select({
      organizationId: organization_memberships.organization_id,
      roleId: organization_memberships.role_id,
    })
    .from(organization_memberships)
    .where(
      and(
        eq(organization_memberships.user_id, user.id),
        eq(organization_memberships.organization_id, parsed.data),
      ),
    )
    .limit(1);

  if (!membership) {
    return { ok: false, error: "You are not a member of this organization." };
  }

  await db
    .update(profiles)
    .set({
      organization_id: membership.organizationId,
      role_id: membership.roleId,
    })
    .where(eq(profiles.id, user.id));

  revalidateAllDashboardForOrganization(membership.organizationId);
  revalidatePath("/organization");
  revalidatePath("/dashboard");
  revalidatePath("/roles");
  revalidatePath("/billing");
  revalidatePath("/deals");
  return { ok: true, message: "Organization switched." };
}
