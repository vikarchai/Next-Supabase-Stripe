import { z } from "zod";

import type { DealTableRow } from "@/components/deals/DealsTable";
import type { DealStatus } from "@/components/deals/deal-status";
import { getViewer } from "@/lib/auth/viewer";
import { assertDealCapacity } from "@/lib/billing/plan-enforcement";
import {
  getCachedDealTableRows,
  getCachedDealsOrgProjects,
} from "@/lib/dashboard-cache/deals-data";
import {
  PERM_DEALS_CREATE,
  PERM_DEALS_DELETE,
  PERM_DEALS_READ,
  PERM_DEALS_UPDATE,
  getPermissionCodesForUser,
} from "@/lib/permissions";

function formatDealDateTime(value: Date | null | undefined): string {
  if (!value) return "—";
  try {
    return value.toLocaleString("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export type DealsApiErrorCode =
  | "unauthenticated"
  | "no_organization"
  | "forbidden"
  | "no_projects";

export type DealsApiResult =
  | {
      ok: true;
      rows: DealTableRow[];
      canCreateDeal: boolean;
      createDealBlockedReason: string | null;
      canUpdateDeal: boolean;
      canDeleteDeal: boolean;
      dealProjects: { id: string; name: string }[];
      defaultProjectId: string;
      projectFilterId: "all" | string;
      projectScopeDescription: string | null;
    }
  | { ok: false; code: DealsApiErrorCode; message: string };

export async function loadDealsApiPayload(
  projectQuery: string | undefined,
): Promise<DealsApiResult> {
  const viewer = await getViewer();
  if (!viewer) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "Not authenticated.",
    };
  }

  const organizationId = viewer.profile?.organizationId;
  if (!organizationId) {
    return {
      ok: false,
      code: "no_organization",
      message: "No organization.",
    };
  }

  const permissionCodes = await getPermissionCodesForUser(viewer.user.id);
  if (!permissionCodes.has(PERM_DEALS_READ)) {
    return {
      ok: false,
      code: "forbidden",
      message: "You don’t have permission to view deals.",
    };
  }

  const [orgProjects, dealPlanGate] = await Promise.all([
    getCachedDealsOrgProjects(organizationId),
    assertDealCapacity(organizationId, {
      planSlugHint: viewer.profile?.organizationPlanSlug,
    }),
  ]);

  const projectIdSet = new Set(orgProjects.map((p) => p.id));
  const defaultProjectRow = orgProjects.find((p) => p.isDefault);
  const defaultProjectId = defaultProjectRow?.id ?? orgProjects[0]?.id ?? "";

  if (!defaultProjectId) {
    return {
      ok: false,
      code: "no_projects",
      message: "No projects in this organization.",
    };
  }

  let filterProjectId: "all" | string = "all";
  const q = projectQuery?.trim();
  if (q && z.string().uuid().safeParse(q).success && projectIdSet.has(q)) {
    filterProjectId = q;
  }

  const canCreateDeal = permissionCodes.has(PERM_DEALS_CREATE);
  const canUpdateDeal = permissionCodes.has(PERM_DEALS_UPDATE);
  const canDeleteDeal = permissionCodes.has(PERM_DEALS_DELETE);
  const canCreateDealByPlan = dealPlanGate.ok;
  const createDealPlanMessage = dealPlanGate.ok ? null : dealPlanGate.error;

  const cachedRows = await getCachedDealTableRows(
    organizationId,
    filterProjectId,
  );

  const rows: DealTableRow[] = cachedRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as DealStatus,
    startAtIso: r.startAtIso,
    endAtIso: r.endAtIso,
    amountNote: r.amountNote,
    creatorName: r.creatorName ?? "—",
    createdAtLabel: formatDealDateTime(new Date(r.createdAtIso)),
    pdfOriginalName: r.pdfOriginalName,
    hasPdf: r.hasPdf,
    projectName: r.projectName,
  }));

  const dealProjects = orgProjects.map((p) => ({ id: p.id, name: p.name }));
  const filteredName =
    filterProjectId === "all"
      ? null
      : orgProjects.find((p) => p.id === filterProjectId)?.name ?? null;
  const projectScopeDescription =
    orgProjects.length <= 1
      ? null
      : filterProjectId === "all"
        ? "Across all projects in your organization."
        : filteredName
          ? `Only deals in “${filteredName}”.`
          : null;

  return {
    ok: true,
    rows,
    canCreateDeal: canCreateDeal && canCreateDealByPlan,
    createDealBlockedReason:
      canCreateDeal && !canCreateDealByPlan ? createDealPlanMessage : null,
    canUpdateDeal,
    canDeleteDeal,
    dealProjects,
    defaultProjectId,
    projectFilterId: filterProjectId,
    projectScopeDescription,
  };
}
