import { sql } from "drizzle-orm";

import {
  assertMemberCapacityForInvite,
  assertProjectCapacity,
} from "@/lib/billing/plan-enforcement";
import {
  getPlanDefinitionBySlug,
  isUnlimitedNumeric,
} from "@/lib/billing/plan-limits";
import { getCachedOrganizationLists } from "@/lib/dashboard-cache/organization-data";
import { getViewer } from "@/lib/auth/viewer";
import { getDb } from "@/db";
import {
  getPermissionCodesForUser,
  PERM_PROJECTS_MANAGE,
} from "@/lib/permissions";
import type { ProjectWithDealCount } from "@/lib/projects/org-projects";

function formatProjectCreatedLabel(d: Date) {
  try {
    return d.toLocaleDateString("en-US", { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

export type OrganizationApiErrorCode = "unauthenticated";

export type OrganizationMemberRow = {
  id: string;
  fullName: string | null;
  roleName: string | null;
  email: string | null;
  lastSignIn: string | null;
};

export type OrganizationInviteRow = {
  id: string;
  email: string;
  roleName: string | null;
  createdAtIso: string;
};

export type OrganizationProjectRow = {
  id: string;
  name: string;
  isDefault: boolean;
  dealCount: number;
  createdAtLabel: string;
};

export type OrganizationApiResult =
  | {
      ok: true;
      org: {
        organizationId: string;
        organizationName: string;
      } | null;
      profileRoleName: string | null;
      profileRoleSlug: string | null;
      mayCreateOwnOrganization: boolean;
      planLabel: string;
      limitsSummary: string;
      organizationProjectRows: OrganizationProjectRow[];
      canManageProjects: boolean;
      projectCapacityOk: boolean;
      canInviteMembers: boolean;
      inviteMemberPlanOk: boolean;
      inviteMemberPlanError: string | null;
      canCreateOrganization: boolean;
      canSwitchOrganization: boolean;
      canManagePendingInvites: boolean;
      showOrgToolbar: boolean;
      organizationsForSwitcher: {
        id: string;
        name: string;
        roleName: string | null;
      }[];
      members: OrganizationMemberRow[];
      pendingInvites: OrganizationInviteRow[];
      hasAnyRows: boolean;
    }
  | { ok: false; code: OrganizationApiErrorCode; message: string };

export async function loadOrganizationApiPayload(): Promise<OrganizationApiResult> {
  const viewer = await getViewer();
  if (!viewer) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "No user session.",
    };
  }

  const { user, profile } = viewer;
  const org = profile?.organizationId
    ? {
        organizationId: profile.organizationId,
        organizationName: profile.organizationName ?? "—",
      }
    : null;

  let permissionCodes = new Set<string>();
  let memberships: {
    id: string;
    name: string;
    roleName: string | null;
  }[] = [];
  let membersCore: {
    id: string;
    fullName: string | null;
    roleName: string | null;
  }[] = [];
  let pendingInvitesRaw: {
    id: string;
    email: string;
    roleName: string | null;
    createdAt: Date;
  }[] = [];
  let projectsWithCounts: ProjectWithDealCount[] = [];

  if (org) {
    const [permResult, cached] = await Promise.all([
      getPermissionCodesForUser(user.id),
      getCachedOrganizationLists(user.id, org.organizationId),
    ]);
    permissionCodes = permResult;
    memberships = cached.memberships;
    membersCore = cached.members;
    pendingInvitesRaw = cached.pendingInvitesRaw.map((r) => ({
      id: r.id,
      email: r.email,
      roleName: r.roleName,
      createdAt: new Date(r.createdAtIso),
    }));
    projectsWithCounts = cached.projectsWithCounts.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      createdAt: new Date(p.createdAtIso),
      dealCount: p.dealCount,
    }));
  }

  const authById = new Map<
    string,
    { email: string | null; lastSignIn: string | null }
  >();
  if (membersCore.length > 0) {
    try {
      const db = getDb();
      const ids = membersCore.map((m) => m.id);
      const idList = sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      );
      const authRows = await db.execute(
        sql`select id, email, last_sign_in_at from auth.users where id in (${idList})`,
      );
      for (const row of authRows as unknown as {
        id: string;
        email: string | null;
        last_sign_in_at: string | null;
      }[]) {
        authById.set(row.id, {
          email: row.email,
          lastSignIn: row.last_sign_in_at,
        });
      }
    } catch {
      /* pooler role may not read auth schema */
    }
  }

  const members: OrganizationMemberRow[] = membersCore.map((m) => {
    const auth = authById.get(m.id);
    return {
      id: m.id,
      fullName: m.fullName,
      roleName: m.roleName,
      email: auth?.email ?? null,
      lastSignIn: auth?.lastSignIn ?? null,
    };
  });

  const memberEmailsLower = new Set<string>();
  for (const m of members) {
    const e = m.email?.trim().toLowerCase();
    if (e) memberEmailsLower.add(e);
  }

  const pendingInvites: OrganizationInviteRow[] = pendingInvitesRaw
    .filter(
      (inv) => !memberEmailsLower.has(inv.email.trim().toLowerCase()),
    )
    .map((inv) => ({
      id: inv.id,
      email: inv.email,
      roleName: inv.roleName,
      createdAtIso: inv.createdAt.toISOString(),
    }));

  const hasAnyRows = members.length > 0 || pendingInvites.length > 0;

  const organizationsForSwitcher =
    memberships.length > 0
      ? memberships
      : org
        ? [
            {
              id: org.organizationId,
              name: org.organizationName,
              roleName: profile?.roleName ?? null,
            },
          ]
        : [];

  const showOrgToolbar =
    Boolean(org?.organizationId) &&
    (Boolean(profile?.mayCreateOwnOrganization) ||
      (permissionCodes.has("organizations:switch") &&
        organizationsForSwitcher.length > 1));

  const planSlugHint = profile?.organizationPlanSlug ?? null;
  const [inviteMemberPlanGate, projectCapacityGate] = org
    ? await Promise.all([
        assertMemberCapacityForInvite(org.organizationId, { planSlugHint }),
        assertProjectCapacity(org.organizationId, { planSlugHint }),
      ])
    : ([{ ok: true }, { ok: false }] as const);

  const canInviteMembers = org
    ? permissionCodes.has("members:invite")
    : false;
  const canCreateOrganization = Boolean(profile?.mayCreateOwnOrganization);
  const canSwitchOrganization = permissionCodes.has("organizations:switch");
  const canManagePendingInvites = Boolean(org && profile?.roleSlug === "owner");
  const canManageProjects = permissionCodes.has(PERM_PROJECTS_MANAGE);

  const planLabel =
    profile?.organizationPlan && profile?.organizationPlanSlug
      ? `${profile.organizationPlan} (${profile.organizationPlanSlug})`
      : (profile?.organizationPlan ?? "—");

  const planSlug = profile?.organizationPlanSlug ?? "free";
  const limits = getPlanDefinitionBySlug(planSlug).limits;
  const fmtN = (n: number, unit: string) =>
    isUnlimitedNumeric(n) ? `Unlimited ${unit}` : `${n} ${unit}`;
  const limitsSummary = [
    fmtN(limits.projects, "projects"),
    fmtN(limits.members, "members in organization"),
    fmtN(limits.items, "deals"),
    `${limits.storage} MB storage`,
    isUnlimitedNumeric(limits.analyticsDays)
      ? "Full analytics history"
      : `${limits.analyticsDays}-day analytics`,
  ].join(" · ");

  const organizationProjectRows: OrganizationProjectRow[] = org
    ? projectsWithCounts.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
        dealCount: p.dealCount,
        createdAtLabel: formatProjectCreatedLabel(p.createdAt),
      }))
    : [];

  return {
    ok: true,
    org,
    profileRoleName: profile?.roleName ?? null,
    profileRoleSlug: profile?.roleSlug ?? null,
    mayCreateOwnOrganization: Boolean(profile?.mayCreateOwnOrganization),
    planLabel,
    limitsSummary,
    organizationProjectRows,
    canManageProjects,
    projectCapacityOk: projectCapacityGate.ok,
    canInviteMembers,
    inviteMemberPlanOk: inviteMemberPlanGate.ok,
    inviteMemberPlanError: inviteMemberPlanGate.ok
      ? null
      : inviteMemberPlanGate.error,
    canCreateOrganization,
    canSwitchOrganization,
    canManagePendingInvites,
    showOrgToolbar,
    organizationsForSwitcher,
    members,
    pendingInvites,
    hasAnyRows,
  };
}
