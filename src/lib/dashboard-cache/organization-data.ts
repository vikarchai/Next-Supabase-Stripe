import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  organization_invites,
  organization_memberships,
  organizations,
  profiles,
  roles,
} from "@/db/schema";
import { listProjectsWithDealCountsForOrganization } from "@/lib/projects/org-projects";

import {
  DASHBOARD_DATA_REVALIDATE_SECONDS,
  tagDashboardOrganization,
} from "./tags";

export type CachedMembershipRow = {
  id: string;
  name: string;
  roleName: string | null;
};

export type CachedMemberRow = {
  id: string;
  fullName: string | null;
  roleName: string | null;
};

export type CachedPendingInviteRow = {
  id: string;
  email: string;
  roleName: string | null;
  createdAtIso: string;
};

export type CachedProjectCountRow = {
  id: string;
  name: string;
  isDefault: boolean;
  dealCount: number;
  createdAtIso: string;
};

/**
 * Org-scoped lists (members, invites, projects). Keyed by user so membership
 * switcher stays correct per account.
 */
export async function getCachedOrganizationLists(
  userId: string,
  organizationId: string,
): Promise<{
  memberships: CachedMembershipRow[];
  members: CachedMemberRow[];
  pendingInvitesRaw: CachedPendingInviteRow[];
  projectsWithCounts: CachedProjectCountRow[];
}> {
  return unstable_cache(
    async () => {
      const db = getDb();

      const [memberships, members, pendingInvitesRaw, projectsRaw] =
        await Promise.all([
          db
            .select({
              id: organization_memberships.organization_id,
              name: organizations.name,
              roleName: roles.name,
            })
            .from(organization_memberships)
            .innerJoin(
              organizations,
              eq(organization_memberships.organization_id, organizations.id),
            )
            .leftJoin(
              roles,
              eq(organization_memberships.role_id, roles.id),
            )
            .where(eq(organization_memberships.user_id, userId))
            .orderBy(asc(organizations.name)),
          db
            .select({
              id: profiles.id,
              fullName: profiles.full_name,
              roleName: roles.name,
            })
            .from(profiles)
            .leftJoin(roles, eq(profiles.role_id, roles.id))
            .where(eq(profiles.organization_id, organizationId))
            .orderBy(asc(profiles.full_name)),
          db
            .select({
              id: organization_invites.id,
              email: organization_invites.email,
              roleName: roles.name,
              createdAt: organization_invites.created_at,
            })
            .from(organization_invites)
            .innerJoin(roles, eq(organization_invites.role_id, roles.id))
            .where(
              eq(organization_invites.organization_id, organizationId),
            )
            .orderBy(asc(organization_invites.email)),
          listProjectsWithDealCountsForOrganization(organizationId),
        ]);

      return {
        memberships,
        members,
        pendingInvitesRaw: pendingInvitesRaw.map((r) => ({
          id: r.id,
          email: r.email,
          roleName: r.roleName,
          createdAtIso: r.createdAt.toISOString(),
        })),
        projectsWithCounts: projectsRaw.map((p) => ({
          id: p.id,
          name: p.name,
          isDefault: p.isDefault,
          dealCount: p.dealCount,
          createdAtIso: p.createdAt.toISOString(),
        })),
      };
    },
    ["dashboard-organization-lists", userId, organizationId],
    {
      revalidate: DASHBOARD_DATA_REVALIDATE_SECONDS,
      tags: [tagDashboardOrganization(organizationId)],
    },
  )();
}
