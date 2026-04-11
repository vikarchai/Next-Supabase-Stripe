"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { z } from "zod";

import { getDb } from "@/db";
import {
  formatPromoSummary,
  getPromoBlockingReasonForUser,
  normalizePromoCode,
} from "@/lib/billing/promo";
import {
  isStripeSecretConfigured,
  resolveStripePriceIdForPlan,
} from "@/lib/billing/plans";
import { customers, plans, promo_codes } from "@/db/schema";
import { getViewer } from "@/lib/auth/viewer";
import { getPermissionCodesForUser } from "@/lib/permissions";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe/server";

async function requireBillingManage(): Promise<{
  userId: string;
  organizationId: string;
  email: string | undefined;
}> {
  const viewer = await getViewer();
  if (!viewer?.profile?.organizationId) redirect("/login");
  const codes = await getPermissionCodesForUser(viewer.user.id);
  if (!codes.has("billing:manage")) {
    redirect("/billing?error=forbidden");
  }
  return {
    userId: viewer.user.id,
    organizationId: viewer.profile.organizationId,
    email: viewer.user.email ?? undefined,
  };
}

async function getOrCreateStripeCustomer(
  organizationId: string,
  email: string | undefined,
): Promise<string> {
  const db = getDb();
  const [existing] = await db
    .select({ stripe_customer_id: customers.stripe_customer_id })
    .from(customers)
    .where(eq(customers.organization_id, organizationId))
    .limit(1);
  if (existing) return existing.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { organization_id: organizationId },
  });

  await db
    .insert(customers)
    .values({
      organization_id: organizationId,
      stripe_customer_id: customer.id,
    })
    .onConflictDoUpdate({
      target: customers.organization_id,
      set: { stripe_customer_id: customer.id },
    });

  return customer.id;
}

async function requireBillingRead(): Promise<{ userId: string } | null> {
  const viewer = await getViewer();
  if (!viewer?.profile) return null;
  const codes = await getPermissionCodesForUser(viewer.user.id);
  if (!codes.has("billing:read")) return null;
  return { userId: viewer.user.id };
}

export type PromoApplyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "applied";
      id: string;
      summary: string;
      description: string;
    };

/** Validates a promo for the current user (billing:read). Used from the billing UI before checkout. */
export async function verifyPromoCodeAction(
  raw: string,
): Promise<PromoApplyState> {
  const ctx = await requireBillingRead();
  if (!ctx) {
    return {
      status: "error",
      message: "Sign in with billing access to use promo codes.",
    };
  }
  const code = normalizePromoCode(raw);
  if (!code) {
    return { status: "error", message: "Enter a promo code." };
  }
  const db = getDb();
  const [row] = await db
    .select()
    .from(promo_codes)
    .where(eq(promo_codes.code, code))
    .limit(1);
  if (!row) {
    return { status: "error", message: "Unknown promo code." };
  }
  const reason = await getPromoBlockingReasonForUser(db, row, ctx.userId);
  if (reason) {
    return { status: "error", message: reason };
  }
  return {
    status: "applied",
    id: row.id,
    summary: formatPromoSummary(row),
    description: row.description?.trim() ? row.description : "—",
  };
}

const PAID_CHECKOUT_SLUGS = new Set(["pro_starter", "pro_business"]);

/** Starts Stripe Checkout for a paid plan (`pro` | `business`). Price from `plans.stripe_price_id` or env. */
export async function startPlanCheckoutAction(
  formData: FormData,
): Promise<void> {
  const { userId, organizationId, email } = await requireBillingManage();
  const slug = String(formData.get("plan_slug") ?? "").trim();
  if (!PAID_CHECKOUT_SLUGS.has(slug)) {
    redirect("/billing?error=invalid_plan");
  }

  if (!isStripeSecretConfigured()) {
    redirect("/billing?error=no_stripe");
  }

  const db = getDb();
  const [planRow] = await db
    .select()
    .from(plans)
    .where(eq(plans.slug, slug))
    .limit(1);
  if (!planRow) {
    redirect("/billing?error=invalid_plan");
  }

  const priceId = resolveStripePriceIdForPlan(planRow);
  if (!priceId) {
    redirect("/billing?error=no_price");
  }

  const stripe = getStripe();
  const stripeCustomerId = await getOrCreateStripeCustomer(
    organizationId,
    email,
  );
  const base = getPublicSiteUrl();

  const promoIdParsed = z
    .string()
    .uuid()
    .safeParse(String(formData.get("promo_code_id") ?? "").trim());

  let allowPromotionCodes = true;
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  const sessionMetadata: Record<string, string> = {
    organization_id: organizationId,
  };

  if (promoIdParsed.success) {
    const [promoRow] = await db
      .select()
      .from(promo_codes)
      .where(eq(promo_codes.id, promoIdParsed.data))
      .limit(1);
    if (!promoRow) {
      redirect("/billing?error=promo_invalid");
    }
    const promoReason = await getPromoBlockingReasonForUser(
      db,
      promoRow,
      userId,
    );
    if (promoReason) {
      redirect("/billing?error=promo_invalid");
    }

    const price = await stripe.prices.retrieve(priceId);
    const currency = price.currency;
    const couponParams: Stripe.CouponCreateParams = {
      duration: "once",
      name: `Promo ${promoRow.code}`.slice(0, 40),
    };
    if (promoRow.discount_kind === "percent") {
      couponParams.percent_off = promoRow.discount_percent ?? undefined;
    } else {
      couponParams.amount_off = promoRow.discount_amount_cents ?? undefined;
      couponParams.currency = currency;
    }
    const coupon = await stripe.coupons.create(couponParams);
    discounts = [{ coupon: coupon.id }];
    sessionMetadata.promo_code_id = promoRow.id;
    sessionMetadata.user_id = userId;
    allowPromotionCodes = false;
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/billing?checkout=success`,
    cancel_url: `${base}/billing?canceled=1`,
    allow_promotion_codes: allowPromotionCodes,
    metadata: sessionMetadata,
    subscription_data: {
      metadata: { organization_id: organizationId },
    },
  };
  if (discounts) {
    sessionParams.discounts = discounts;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  redirect(session.url);
}

/** Opens the Stripe Customer Portal for the active project’s Stripe customer. */
export async function openCustomerPortalAction(): Promise<void> {
  const { organizationId } = await requireBillingManage();
  if (!isStripeSecretConfigured()) {
    redirect("/billing?error=no_stripe");
  }
  const db = getDb();
  const [row] = await db
    .select({ stripe_customer_id: customers.stripe_customer_id })
    .from(customers)
    .where(eq(customers.organization_id, organizationId))
    .limit(1);

  if (!row) {
    redirect("/billing?error=no_customer");
  }

  const stripe = getStripe();
  const base = getPublicSiteUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${base}/billing`,
  });
  redirect(portal.url);
}
