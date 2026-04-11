import { and, count, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { promo_codes, promo_redemptions } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

export type PromoRow = typeof promo_codes.$inferSelect;

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function formatPromoSummary(
  row: Pick<
    PromoRow,
    "discount_kind" | "discount_percent" | "discount_amount_cents"
  >,
): string {
  if (row.discount_kind === "percent") {
    return `${row.discount_percent}% off`;
  }
  const cents = row.discount_amount_cents ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Static rules (dates, caps, discount shape). Does not check per-user redemption. */
export function basePromoBlockingReason(row: PromoRow): string | null {
  if (!row.active) return "This promo code is inactive.";
  const now = Date.now();
  if (row.valid_from && row.valid_from.getTime() > now) {
    return "This promo code is not valid yet.";
  }
  if (row.valid_until && row.valid_until.getTime() < now) {
    return "This promo code has expired.";
  }
  if (row.discount_kind === "percent") {
    const p = row.discount_percent;
    if (p == null || p < 1 || p > 100) return "Invalid promo configuration.";
  } else {
    const c = row.discount_amount_cents;
    if (c == null || c < 1) return "Invalid promo configuration.";
  }
  if (row.usage_mode === "single_use") {
    if (row.redemption_count >= 1) {
      return "This promo code has already been used.";
    }
  } else if (
    row.max_redemptions != null &&
    row.redemption_count >= row.max_redemptions
  ) {
    return "This promo code has reached its redemption limit.";
  }
  return null;
}

export async function getPromoBlockingReasonForUser(
  db: Db,
  row: PromoRow,
  userId: string,
): Promise<string | null> {
  const base = basePromoBlockingReason(row);
  if (base) return base;
  if (row.once_per_user) {
    const [r] = await db
      .select({ n: count() })
      .from(promo_redemptions)
      .where(
        and(
          eq(promo_redemptions.promo_code_id, row.id),
          eq(promo_redemptions.user_id, userId),
        ),
      );
    if ((r?.n ?? 0) > 0) {
      return "You’ve already used this promo code.";
    }
  }
  return null;
}

export async function recordPromoRedemption(args: {
  db: Db;
  promoCodeId: string;
  userId: string;
  stripeCheckoutSessionId: string;
}): Promise<void> {
  await args.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(promo_redemptions)
      .values({
        promo_code_id: args.promoCodeId,
        user_id: args.userId,
        stripe_checkout_session_id: args.stripeCheckoutSessionId,
      })
      .onConflictDoNothing({
        target: promo_redemptions.stripe_checkout_session_id,
      })
      .returning({ id: promo_redemptions.id });
    if (inserted.length === 0) return;
    await tx
      .update(promo_codes)
      .set({
        redemption_count: sql`${promo_codes.redemption_count} + 1`,
      })
      .where(eq(promo_codes.id, args.promoCodeId));
  });
}
