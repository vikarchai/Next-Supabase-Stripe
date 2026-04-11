import { unstable_cache } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import { deals, profiles, projects } from "@/db/schema";
import { listProjectsForOrganization } from "@/lib/projects/org-projects";

import {
  DASHBOARD_DATA_REVALIDATE_SECONDS,
  tagDashboardDeals,
} from "./tags";

export type CachedOrgProjectRow = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type CachedDealRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startAtIso: string | null;
  endAtIso: string | null;
  amountNote: string | null;
  creatorName: string | null;
  createdAtIso: string;
  pdfOriginalName: string | null;
  hasPdf: boolean;
  projectName: string;
};

export async function getCachedDealsOrgProjects(
  organizationId: string,
): Promise<CachedOrgProjectRow[]> {
  return unstable_cache(
    async () => {
      const rows = await listProjectsForOrganization(organizationId);
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        isDefault: p.isDefault,
      }));
    },
    ["dashboard-deals-org-projects", organizationId],
    {
      revalidate: DASHBOARD_DATA_REVALIDATE_SECONDS,
      tags: [tagDashboardDeals(organizationId)],
    },
  )();
}

export async function getCachedDealTableRows(
  organizationId: string,
  filterProjectId: string | "all",
): Promise<CachedDealRow[]> {
  return unstable_cache(
    async () => {
      const db = getDb();
      const dealCreator = alias(profiles, "deal_creator");
      const dealProject = alias(projects, "deal_project");
      const projectWhere =
        filterProjectId === "all"
          ? sql`true`
          : eq(deals.project_id, filterProjectId);

      const raw = await db
        .select({
          deal: deals,
          creatorName: dealCreator.full_name,
          projectName: dealProject.name,
        })
        .from(deals)
        .innerJoin(dealCreator, eq(deals.created_by, dealCreator.id))
        .innerJoin(dealProject, eq(deals.project_id, dealProject.id))
        .where(
          and(eq(deals.organization_id, organizationId), projectWhere),
        )
        .orderBy(desc(deals.created_at));

      return raw.map(({ deal, creatorName, projectName }) => ({
        id: deal.id,
        title: deal.title,
        description: deal.description,
        status: deal.status,
        startAtIso: deal.start_at ? deal.start_at.toISOString() : null,
        endAtIso: deal.end_at ? deal.end_at.toISOString() : null,
        amountNote: deal.amount_note,
        creatorName,
        createdAtIso: deal.created_at.toISOString(),
        pdfOriginalName: deal.pdf_original_name,
        hasPdf: Boolean(deal.pdf_storage_path),
        projectName,
      }));
    },
    ["dashboard-deals-table", organizationId, filterProjectId],
    {
      revalidate: DASHBOARD_DATA_REVALIDATE_SECONDS,
      tags: [tagDashboardDeals(organizationId)],
    },
  )();
}
