import { randomUUID } from "crypto";
import { and, asc, count, eq } from "drizzle-orm";

import { type Database, getDb } from "@/db";
import { deals, projects } from "@/db/schema";

export const DEFAULT_PROJECT_NAME = "Default project";

export type ProjectWithDealCount = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  dealCount: number;
};

export async function insertDefaultProjectForOrganization(
  db: Database,
  organizationId: string,
): Promise<string> {
  const id = randomUUID();
  await db.insert(projects).values({
    id,
    organization_id: organizationId,
    name: DEFAULT_PROJECT_NAME,
    is_default: true,
  });
  return id;
}

export async function listProjectsForOrganization(organizationId: string) {
  const db = getDb();
  return db
    .select({
      id: projects.id,
      name: projects.name,
      isDefault: projects.is_default,
      createdAt: projects.created_at,
    })
    .from(projects)
    .where(eq(projects.organization_id, organizationId))
    .orderBy(asc(projects.is_default), asc(projects.name));
}

/** One round-trip: projects in the org with deal counts (0 if none). */
export async function listProjectsWithDealCountsForOrganization(
  organizationId: string,
): Promise<ProjectWithDealCount[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      isDefault: projects.is_default,
      createdAt: projects.created_at,
      dealCount: count(deals.id),
    })
    .from(projects)
    .leftJoin(deals, eq(deals.project_id, projects.id))
    .where(eq(projects.organization_id, organizationId))
    .groupBy(
      projects.id,
      projects.name,
      projects.is_default,
      projects.created_at,
    )
    .orderBy(asc(projects.is_default), asc(projects.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.isDefault,
    createdAt: r.createdAt,
    dealCount: Number(r.dealCount),
  }));
}

/** Deal counts per project id (only rows with ≥1 deal). Prefer `listProjectsWithDealCountsForOrganization` when you need zeros too. */
export async function getDealCountsByProjectForOrganization(
  organizationId: string,
): Promise<Map<string, number>> {
  const db = getDb();
  const rows = await db
    .select({
      projectId: deals.project_id,
      n: count(),
    })
    .from(deals)
    .where(eq(deals.organization_id, organizationId))
    .groupBy(deals.project_id);
  return new Map(rows.map((r) => [r.projectId, Number(r.n)]));
}

export async function getDefaultProjectIdForOrganization(
  organizationId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.organization_id, organizationId),
        eq(projects.is_default, true),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export async function assertProjectBelongsToOrganization(
  projectId: string,
  organizationId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.organization_id, organizationId)),
    )
    .limit(1);
  return Boolean(row);
}
