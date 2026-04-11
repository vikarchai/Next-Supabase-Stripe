import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations, plans, subscriptions } from "@/db/schema";

import { getFreePlanId } from "./plans";

const PAID_LIKE_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "paused",
] as const;

/**
 * Sets `organizations.plan_id` from Stripe-backed `subscriptions` (+ `plans.stripe_price_id`
 * or env price IDs for the canonical slugs `pro_starter` / `pro_business`).
 */
export async function recomputeOrganizationPlan(
  organizationId: string,
): Promise<void> {
  const db = getDb();
  const freeId = await getFreePlanId();

  const [sub] = await db
    .select({
      price_id: subscriptions.price_id,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organization_id, organizationId),
        inArray(subscriptions.status, [...PAID_LIKE_STATUSES]),
      ),
    )
    .orderBy(desc(subscriptions.created))
    .limit(1);

  if (!sub?.price_id) {
    await db
      .update(organizations)
      .set({ plan_id: freeId })
      .where(eq(organizations.id, organizationId));
    return;
  }

  const [byStripePrice] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.stripe_price_id, sub.price_id))
    .limit(1);

  if (byStripePrice) {
    await db
      .update(organizations)
      .set({ plan_id: byStripePrice.id })
      .where(eq(organizations.id, organizationId));
    return;
  }

  const envBusinessPrice = process.env.STRIPE_BUSINESS_PRICE_ID?.trim();
  if (envBusinessPrice && sub.price_id === envBusinessPrice) {
    const [row] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.slug, "pro_business"))
      .limit(1);
    if (row) {
      await db
        .update(organizations)
        .set({ plan_id: row.id })
        .where(eq(organizations.id, organizationId));
    } else {
      await db
        .update(organizations)
        .set({ plan_id: freeId })
        .where(eq(organizations.id, organizationId));
    }
    return;
  }

  const envProPrice = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (envProPrice && sub.price_id === envProPrice) {
    const [row] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.slug, "pro_starter"))
      .limit(1);
    if (row) {
      await db
        .update(organizations)
        .set({ plan_id: row.id })
        .where(eq(organizations.id, organizationId));
    } else {
      await db
        .update(organizations)
        .set({ plan_id: freeId })
        .where(eq(organizations.id, organizationId));
    }
    return;
  }

  await db
    .update(organizations)
    .set({ plan_id: freeId })
    .where(eq(organizations.id, organizationId));
}
