import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { plans } from "@/db/schema";

let cachedFreePlanId: string | null = null;

/** Canonical billing tiers (global `plans` rows). Stripe price ids are filled from DB or env at runtime. */
export const ALL_PLAN_DEFINITIONS = [
  { slug: "free", name: "Free", stripe_price_id: null as string | null },
  { slug: "pro_starter", name: "Starter Pro", stripe_price_id: null as string | null },
  { slug: "pro_business", name: "Business Elite", stripe_price_id: null as string | null },
] as const;

/** Upsert plan names by slug; does not overwrite existing `stripe_price_id`. */
export async function syncBillingPlans(): Promise<void> {
  const db = getDb();
  cachedFreePlanId = null;
  for (const p of ALL_PLAN_DEFINITIONS) {
    await db
      .insert(plans)
      .values({
        slug: p.slug,
        name: p.name,
        stripe_price_id: p.stripe_price_id,
      })
      .onConflictDoUpdate({
        target: plans.slug,
        set: { name: p.name },
      });
  }
}

export async function getFreePlanId(): Promise<string> {
  if (cachedFreePlanId) return cachedFreePlanId;
  const db = getDb();
  const [row] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.slug, "free"))
    .limit(1);
  if (!row) {
    throw new Error(
      'Missing plans row with slug "free". Run `npm run db:seed` (or open signup once so reference data syncs).',
    );
  }
  cachedFreePlanId = row.id;
  return row.id;
}

/** Billing UI order (DB may not have a sort column). */
export const BILLING_PLAN_SLUG_ORDER = [
  "free",
  "pro_starter",
  "pro_business",
] as const satisfies readonly (typeof ALL_PLAN_DEFINITIONS)[number]["slug"][];

export function compareBillingPlanSlug(a: string, b: string): number {
  const ia = BILLING_PLAN_SLUG_ORDER.indexOf(
    a as (typeof BILLING_PLAN_SLUG_ORDER)[number],
  );
  const ib = BILLING_PLAN_SLUG_ORDER.indexOf(
    b as (typeof BILLING_PLAN_SLUG_ORDER)[number],
  );
  const ra = ia === -1 ? 999 : ia;
  const rb = ib === -1 ? 999 : ib;
  return ra - rb || a.localeCompare(b);
}

export function sortPlansByBillingOrder<T extends { slug: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((x, y) => compareBillingPlanSlug(x.slug, y.slug));
}

export function sortJoinedPlansByBillingOrder<
  T extends { plan: { slug: string } },
>(rows: T[]): T[] {
  return [...rows].sort((x, y) =>
    compareBillingPlanSlug(x.plan.slug, y.plan.slug),
  );
}

export async function listPlansOrdered() {
  const db = getDb();
  const rows = await db.select().from(plans);
  return sortPlansByBillingOrder(rows);
}

/** Stripe Price id: DB `plans.stripe_price_id`, else env by slug. */
export function resolveStripePriceIdForPlan(row: {
  slug: string;
  stripe_price_id: string | null;
}): string | null {
  const fromDb = row.stripe_price_id?.trim();
  if (fromDb) return fromDb;
  if (row.slug === "pro_starter") {
    return process.env.STRIPE_PRO_PRICE_ID?.trim() || null;
  }
  if (row.slug === "pro_business") {
    return process.env.STRIPE_BUSINESS_PRICE_ID?.trim() || null;
  }
  return null;
}

export function isStripeSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
