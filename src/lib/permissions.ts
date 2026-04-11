import { cache } from "react";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  PERMISSION_CODE_ADMIN_MANAGE,
  PERMISSION_CODE_ADMIN_VIEW,
} from "@/db/role-seed";
import { permissions, profiles, role_permissions } from "@/db/schema";

/** Deal CRUD (used by `src/actions/deals.ts` and pages). */
export const PERM_DEALS_READ = "deals:read";
export const PERM_DEALS_CREATE = "deals:create";
export const PERM_DEALS_UPDATE = "deals:update";
export const PERM_DEALS_DELETE = "deals:delete";
export const PERM_PROJECTS_READ = "projects:read";
export const PERM_PROJECTS_MANAGE = "projects:manage";

export async function assertPermission(
  userId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const codes = await getPermissionCodesForUser(userId);
  if (!codes.has(code)) {
    return {
      ok: false,
      error: "You don’t have permission for this action.",
    };
  }
  return { ok: true };
}

export const getPermissionCodesForUser = cache(async function getPermissionCodesForUser(
  userId: string,
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ code: permissions.code })
    .from(profiles)
    .innerJoin(
      role_permissions,
      eq(profiles.role_id, role_permissions.role_id),
    )
    .innerJoin(
      permissions,
      eq(role_permissions.permission_id, permissions.id),
    )
    .where(eq(profiles.id, userId));
  return new Set(rows.map((r) => r.code));
});

export function canViewAdminRole(codes: Set<string>): boolean {
  return codes.has(PERMISSION_CODE_ADMIN_VIEW);
}

export function canManageAdminRole(codes: Set<string>): boolean {
  return codes.has(PERMISSION_CODE_ADMIN_MANAGE);
}
