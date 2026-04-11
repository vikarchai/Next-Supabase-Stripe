import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";

import { getDb } from "@/db";
import { recordPromoRedemption } from "@/lib/billing/promo";
import { recomputeOrganizationPlan } from "@/lib/billing/organization-plan";
import { getStripe } from "@/lib/stripe/server";
import {
  customers,
  prices,
  products,
  subscriptionStatusEnum,
  subscriptions,
} from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeSubscriptionStatus(
  status: string,
): (typeof subscriptionStatusEnum.enumValues)[number] {
  const allowed = subscriptionStatusEnum.enumValues as readonly string[];
  if (allowed.includes(status)) {
    return status as (typeof subscriptionStatusEnum.enumValues)[number];
  }
  return "canceled";
}

function unixToDate(seconds: number | null | undefined): Date | null {
  if (seconds == null || seconds === 0) return null;
  return new Date(seconds * 1000);
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  if (!item?.price) return null;
  return typeof item.price === "string" ? item.price : item.price.id;
}

async function upsertProductRecord(product: Stripe.Product) {
  const db = getDb();
  await db
    .insert(products)
    .values({
      id: product.id,
      active: product.active,
      name: product.name,
      description: product.description ?? null,
      image: product.images?.[0] ?? null,
      metadata: product.metadata as Record<string, unknown> | null,
    })
    .onConflictDoUpdate({
      target: products.id,
      set: {
        active: product.active,
        name: product.name,
        description: product.description ?? null,
        image: product.images?.[0] ?? null,
        metadata: product.metadata as Record<string, unknown> | null,
      },
    });
}

async function upsertPriceRecord(price: Stripe.Price) {
  const db = getDb();
  const productId =
    typeof price.product === "string" ? price.product : price.product.id;
  await db
    .insert(prices)
    .values({
      id: price.id,
      product_id: productId,
      active: price.active,
      description: price.nickname ?? null,
      unit_amount: price.unit_amount ?? null,
      currency: price.currency,
      type: price.type,
      interval: price.recurring?.interval ?? null,
      interval_count: price.recurring?.interval_count ?? null,
      trial_period_days: price.recurring?.trial_period_days ?? null,
      metadata: price.metadata as Record<string, unknown> | null,
    })
    .onConflictDoUpdate({
      target: prices.id,
      set: {
        product_id: productId,
        active: price.active,
        description: price.nickname ?? null,
        unit_amount: price.unit_amount ?? null,
        currency: price.currency,
        type: price.type,
        interval: price.recurring?.interval ?? null,
        interval_count: price.recurring?.interval_count ?? null,
        trial_period_days: price.recurring?.trial_period_days ?? null,
        metadata: price.metadata as Record<string, unknown> | null,
      },
    });
}

async function resolveOrganizationIdForSubscription(
  subscription: Stripe.Subscription,
  stripeCustomerId: string,
): Promise<string | null> {
  const db = getDb();
  const [byCustomer] = await db
    .select({ organization_id: customers.organization_id })
    .from(customers)
    .where(eq(customers.stripe_customer_id, stripeCustomerId))
    .limit(1);
  if (byCustomer) return byCustomer.organization_id;

  const metaOrg = subscription.metadata?.organization_id;
  if (typeof metaOrg === "string" && metaOrg.length > 0) return metaOrg;

  return null;
}

async function ensureCustomerRow(
  organizationId: string,
  stripeCustomerId: string,
) {
  const db = getDb();
  await db
    .insert(customers)
    .values({
      organization_id: organizationId,
      stripe_customer_id: stripeCustomerId,
    })
    .onConflictDoUpdate({
      target: customers.organization_id,
      set: { stripe_customer_id: stripeCustomerId },
    });
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const organizationId = await resolveOrganizationIdForSubscription(
    subscription,
    customerId,
  );
  if (!organizationId) {
    console.warn(
      "[stripe webhook] subscription without resolvable organization:",
      subscription.id,
    );
    return;
  }

  await ensureCustomerRow(organizationId, customerId);

  const item = subscription.items.data[0];
  const priceId = priceIdFromSubscription(subscription);
  const quantity = item?.quantity ?? 1;

  const db = getDb();
  await db
    .insert(subscriptions)
    .values({
      id: subscription.id,
      organization_id: organizationId,
      status: normalizeSubscriptionStatus(subscription.status),
      price_id: priceId,
      quantity,
      cancel_at_period_end: subscription.cancel_at_period_end,
      created: unixToDate(subscription.created) ?? new Date(),
      current_period_start: unixToDate(subscription.current_period_start),
      current_period_end: unixToDate(subscription.current_period_end),
      ended_at: unixToDate(subscription.ended_at),
      cancel_at: unixToDate(subscription.cancel_at),
      canceled_at: unixToDate(subscription.canceled_at),
      trial_start: unixToDate(subscription.trial_start),
      trial_end: unixToDate(subscription.trial_end),
      metadata: subscription.metadata as Record<string, unknown> | null,
    })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: {
        organization_id: organizationId,
        status: normalizeSubscriptionStatus(subscription.status),
        price_id: priceId,
        quantity,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_start: unixToDate(subscription.current_period_start),
        current_period_end: unixToDate(subscription.current_period_end),
        ended_at: unixToDate(subscription.ended_at),
        cancel_at: unixToDate(subscription.cancel_at),
        canceled_at: unixToDate(subscription.canceled_at),
        trial_start: unixToDate(subscription.trial_start),
        trial_end: unixToDate(subscription.trial_end),
        metadata: subscription.metadata as Record<string, unknown> | null,
      },
    });

  await recomputeOrganizationPlan(organizationId);
}

async function deleteSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const db = getDb();
  const [existing] = await db
    .select({ organization_id: subscriptions.organization_id })
    .from(subscriptions)
    .where(eq(subscriptions.id, subscription.id))
    .limit(1);

  await db.delete(subscriptions).where(eq(subscriptions.id, subscription.id));

  if (existing?.organization_id) {
    await recomputeOrganizationPlan(existing.organization_id);
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  const orgMeta = session.metadata?.organization_id;
  const userMeta = session.metadata?.user_id;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) return;

  if (typeof orgMeta !== "string" || orgMeta.length === 0) return;

  await ensureCustomerRow(orgMeta, customerId);

  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  const promoMeta = session.metadata?.promo_code_id;
  if (paid && typeof promoMeta === "string" && typeof userMeta === "string") {
    const promoIdParsed = z.string().uuid().safeParse(promoMeta);
    if (promoIdParsed.success) {
      try {
        await recordPromoRedemption({
          db: getDb(),
          promoCodeId: promoIdParsed.data,
          userId: userMeta,
          stripeCheckoutSessionId: session.id,
        });
      } catch (e) {
        console.error("[stripe webhook] promo redemption failed:", session.id, e);
      }
    }
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not set." },
      { status: 500 },
    );
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "product.created":
      case "product.updated":
        await upsertProductRecord(event.data.object as Stripe.Product);
        break;
      case "price.created":
      case "price.updated":
        await upsertPriceRecord(event.data.object as Stripe.Price);
        break;
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscriptionFromStripe(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await deleteSubscriptionFromStripe(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
