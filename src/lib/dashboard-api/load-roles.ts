import {
  getCachedPermissionsCatalog,
  getCachedRolesOrgSegment,
} from "@/lib/dashboard-cache/roles-data";
import { getViewer } from "@/lib/auth/viewer";
import {
  canViewAdminRole,
  getPermissionCodesForUser,
} from "@/lib/permissions";

export type RolesApiErrorCode =
  | "unauthenticated"
  | "no_organization"
  | "forbidden";

export type RoleForClient = {
  id: string;
  name: string;
  slug: string | null;
  is_system: boolean;
  permissionCodes: string[];
  permissionIds: string[];
};

export type CatalogPermission = {
  id: string;
  code: string;
  description: string | null;
};

export type RolesApiResult =
  | {
      ok: true;
      rolesForClient: RoleForClient[];
      catalogPermissions: CatalogPermission[];
      allowCreateRole: boolean;
      allowEditRoles: boolean;
      allowDeleteRoles: boolean;
      allowRenameRole: boolean;
    }
  | { ok: false; code: RolesApiErrorCode; message: string };

export async function loadRolesApiPayload(): Promise<RolesApiResult> {
  const viewer = await getViewer();
  if (!viewer) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "No user session.",
    };
  }

  const orgId = viewer.profile?.organizationId;
  if (!orgId) {
    return {
      ok: false,
      code: "no_organization",
      message: "No organization linked to your profile.",
    };
  }

  const userPermissionCodes = await getPermissionCodesForUser(viewer.user.id);
  if (!userPermissionCodes.has("roles:read")) {
    return {
      ok: false,
      code: "forbidden",
      message: "You don’t have permission to view roles.",
    };
  }

  const [allPermissions, orgSegment] = await Promise.all([
    getCachedPermissionsCatalog(),
    getCachedRolesOrgSegment(orgId),
  ]);
  const orgRolesRaw = orgSegment.orgRolesRaw;
  const links = orgSegment.links;

  const canManageRoles = userPermissionCodes.has("roles:manage");
  const canAssignPermissions = userPermissionCodes.has("permissions:assign");
  const allowEditRoles = canManageRoles || canAssignPermissions;
  const showAdmin = canViewAdminRole(userPermissionCodes);

  const catalogPermissions = showAdmin
    ? allPermissions
    : allPermissions.filter((p) => !p.code.startsWith("admin:"));

  const orgRoles = showAdmin
    ? orgRolesRaw
    : orgRolesRaw.filter((r) => r.slug !== "admin");

  const permissionIdsByRole = new Map<string, string[]>();
  for (const link of links) {
    const list = permissionIdsByRole.get(link.roleId) ?? [];
    list.push(link.permissionId);
    permissionIdsByRole.set(link.roleId, list);
  }

  const codeById = new Map(allPermissions.map((p) => [p.id, p.code]));

  const rolesForClient: RoleForClient[] = orgRoles.map((role) => {
    const ids = permissionIdsByRole.get(role.id) ?? [];
    const permissionCodes = ids
      .map((id) => codeById.get(id))
      .filter((c): c is string => Boolean(c))
      .sort((a, b) => a.localeCompare(b));
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      is_system: role.is_system,
      permissionCodes,
      permissionIds: ids,
    };
  });

  return {
    ok: true,
    rolesForClient,
    catalogPermissions,
    allowCreateRole: canManageRoles,
    allowEditRoles,
    allowDeleteRoles: canManageRoles,
    allowRenameRole: canManageRoles,
  };
}
