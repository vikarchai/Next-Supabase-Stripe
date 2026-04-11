import { cache } from "react";
import { count, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  deals,
  organization_invites,
  organization_memberships,
  organizations,
  plans,
  projects,
} from "@/db/schema";

import {
  analyticsCutoffDate,
  getPlanDefinitionBySlug,
  isUnlimitedNumeric,
} from "./plan-limits";

async function fetchOrganizationPlanSlug(
  organizationId: string,
): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ slug: plans.slug })
    .from(organizations)
    .innerJoin(plans, eq(organizations.plan_id, plans.id))
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row?.slug ?? "free";
}

/** One query per request per org (dedupes layout + multiple asserts on the same navigation). */
export const getOrganizationPlanSlug = cache(fetchOrganizationPlanSlug);

export type PlanSlugHint = { planSlugHint?: string | null };

async function resolvePlanSlug(
  organizationId: string,
  hint?: string | null,
): Promise<string> {
  const trimmed = hint?.trim();
  if (trimmed) return trimmed;
  return getOrganizationPlanSlug(organizationId);
}

export async function getDealCountForOrg(organizationId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(deals)
    .where(eq(deals.organization_id, organizationId));
  return Number(row?.n ?? 0);
}

/** Sum of tracked attachment sizes (bytes) in the organization for plan storage. */
export async function getOrgPdfBytesTotal(organizationId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${deals.pdf_bytes}), 0)`,
    })
    .from(deals)
    .where(eq(deals.organization_id, organizationId));
  return Number(row?.total ?? 0);
}

/** Max projects (rows in `projects`) for this organization vs plan. */
export async function assertProjectCapacity(
  organizationId: string,
  opts?: PlanSlugHint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slug = await resolvePlanSlug(organizationId, opts?.planSlugHint);
  const { limits } = getPlanDefinitionBySlug(slug);
  const lim = limits.projects;
  if (isUnlimitedNumeric(lim)) return { ok: true };

  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(projects)
    .where(eq(projects.organization_id, organizationId));
  const n = Number(row?.n ?? 0);
  if (n >= lim) {
    return {
      ok: false,
      error: `Your plan allows up to ${lim} project(s). Upgrade on Billing to add more.`,
    };
  }
  return { ok: true };
}

/** Seat check for invites: members + pending invites in the org. */
export async function assertMemberCapacityForInvite(
  organizationId: string,
  opts?: PlanSlugHint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slug = await resolvePlanSlug(organizationId, opts?.planSlugHint);
  const { limits } = getPlanDefinitionBySlug(slug);
  const lim = limits.members;
  if (isUnlimitedNumeric(lim)) return { ok: true };

  const db = getDb();
  const [mRow] = await db
    .select({ n: count() })
    .from(organization_memberships)
    .where(eq(organization_memberships.organization_id, organizationId));
  const [iRow] = await db
    .select({ n: count() })
    .from(organization_invites)
    .where(eq(organization_invites.organization_id, organizationId));
  const total = Number(mRow?.n ?? 0) + Number(iRow?.n ?? 0);
  if (total >= lim) {
    return {
      ok: false,
      error: `This organization’s plan allows up to ${lim} members (including pending invites). Upgrade on Billing to invite more.`,
    };
  }
  return { ok: true };
}

export async function assertDealCapacity(
  organizationId: string,
  opts?: PlanSlugHint,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const slug = await resolvePlanSlug(organizationId, opts?.planSlugHint);
  const { limits } = getPlanDefinitionBySlug(slug);
  const lim = limits.items;
  if (isUnlimitedNumeric(lim)) return { ok: true };

  const current = await getDealCountForOrg(organizationId);
  if (current >= lim) {
    return {
      ok: false,
      error: `This organization’s plan allows up to ${lim} deals. Upgrade on Billing or remove deals to add more.`,
    };
  }
  return { ok: true };
}

export async function assertPdfStorageAllows(
  organizationId: string,
  additionalBytes: number,
  /** Bytes already counted for the deal being replaced (e.g. old file). */
  replaceBytes: number,
): Promise<{ ok: true; maxSingleFileBytes: number } | { ok: false; error: string }> {
  const slug = await getOrganizationPlanSlug(organizationId);
  const { limits } = getPlanDefinitionBySlug(slug);
  const storageMb = limits.storage;
  const poolBytes =
    storageMb < 0
      ? Number.MAX_SAFE_INTEGER
      : storageMb * 1024 * 1024;

  const maxSingleFileBytes = Math.min(
    50 * 1024 * 1024,
    poolBytes === Number.MAX_SAFE_INTEGER ? 50 * 1024 * 1024 : poolBytes,
  );

  if (additionalBytes > maxSingleFileBytes) {
    return {
      ok: false,
      error: `File must be ${Math.floor(maxSingleFileBytes / (1024 * 1024))} MB or smaller for this organization’s plan.`,
    };
  }

  const used = await getOrgPdfBytesTotal(organizationId);
  const nextTotal = used - replaceBytes + additionalBytes;
  if (nextTotal > poolBytes) {
    const cap =
      storageMb < 0 ? "this plan" : `${storageMb} MB`;
    return {
      ok: false,
      error: `Organization storage would exceed ${cap}. Remove files or upgrade on Billing.`,
    };
  }

  return { ok: true, maxSingleFileBytes };
}

export async function getAnalyticsCreatedAtGte(
  organizationId: string,
): Promise<Date | null> {
  const slug = await getOrganizationPlanSlug(organizationId);
  const { limits } = getPlanDefinitionBySlug(slug);
  return analyticsCutoffDate(new Date(), limits.analyticsDays);
}

export async function orgHasBrandingRemoval(
  organizationId: string,
): Promise<boolean> {
  const slug = await getOrganizationPlanSlug(organizationId);
  return getPlanDefinitionBySlug(slug).limits.brandingRemoval;
}
