import { unstable_cache } from "next/cache";
import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { permissions, role_permissions, roles } from "@/db/schema";

import {
  DASHBOARD_DATA_REVALIDATE_SECONDS,
  TAG_PERMISSIONS_CATALOG,
  tagDashboardRoles,
} from "./tags";

export type CachedPermissionRow = {
  id: string;
  code: string;
  description: string | null;
};

export type CachedOrgRoleRow = {
  id: string;
  name: string;
  is_system: boolean;
  slug: string | null;
};

export type CachedRolePermissionLink = {
  roleId: string;
  permissionId: string;
};

export async function getCachedPermissionsCatalog(): Promise<
  CachedPermissionRow[]
> {
  return unstable_cache(
    async () => {
      const db = getDb();
      return db
        .select({
          id: permissions.id,
          code: permissions.code,
          description: permissions.description,
        })
        .from(permissions)
        .orderBy(asc(permissions.code));
    },
    ["permissions-catalog-v1"],
    {
      revalidate: 3600,
      tags: [TAG_PERMISSIONS_CATALOG],
    },
  )();
}

export async function getCachedRolesOrgSegment(organizationId: string): Promise<{
  orgRolesRaw: CachedOrgRoleRow[];
  links: CachedRolePermissionLink[];
}> {
  return unstable_cache(
    async () => {
      const db = getDb();
      const [orgRolesRaw, links] = await Promise.all([
        db
          .select({
            id: roles.id,
            name: roles.name,
            is_system: roles.is_system,
            slug: roles.slug,
          })
          .from(roles)
          .where(eq(roles.organization_id, organizationId))
          .orderBy(asc(roles.name)),
        db
          .select({
            roleId: role_permissions.role_id,
            permissionId: role_permissions.permission_id,
          })
          .from(role_permissions)
          .innerJoin(roles, eq(role_permissions.role_id, roles.id))
          .where(eq(roles.organization_id, organizationId)),
      ]);
      return { orgRolesRaw, links };
    },
    ["dashboard-roles-org-segment", organizationId],
    {
      revalidate: DASHBOARD_DATA_REVALIDATE_SECONDS,
      tags: [tagDashboardRoles(organizationId)],
    },
  )();
}
