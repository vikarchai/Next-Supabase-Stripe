import { openCustomerPortalAction } from "@/actions/billing";
import { BillingPlansWithPromo } from "@/components/billing/billing-plans-with-promo";
import type {
  PlanPricingCardCta,
  PlanPricingCardModel,
} from "@/components/billing/plan-pricing-cards";
import {
  DashboardPageShell,
  DashboardPanel,
} from "@/components/layout/dashboard-shell";
import { ProfileDetailRows } from "@/components/profile/profile-detail-rows";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { catalogForPlanSlug } from "@/lib/billing/plan-catalog";
import {
  isStripeSecretConfigured,
  resolveStripePriceIdForPlan,
  sortJoinedPlansByBillingOrder,
} from "@/lib/billing/plans";
import { getOrganizationSubscription } from "@/lib/billing/subscription";
import { getViewer } from "@/lib/auth/viewer";
import { getPermissionCodesForUser } from "@/lib/permissions";
import { customers, plans, prices } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function messageForQuery(key: string | undefined): string | null {
  if (!key) return null;
  switch (key) {
    case "forbidden":
      return "You don’t have permission to manage billing.";
    case "no_customer":
      return "No Stripe customer yet. Start checkout to create one.";
    case "no_stripe":
      return "Stripe is not configured (STRIPE_SECRET_KEY).";
    case "no_price":
      return "No price ID for that plan. Set plans.stripe_price_id or STRIPE_PRO_PRICE_ID / STRIPE_BUSINESS_PRICE_ID.";
    case "invalid_plan":
      return "That plan is not available for checkout.";
    case "success":
      return "Checkout completed. Subscription updates shortly via webhooks.";
    case "canceled":
      return "Checkout was canceled.";
    default:
      return null;
  }
}

function formatCents(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function resolvePlanCta(args: {
  slug: string;
  isCurrent: boolean;
  onFreeTier: boolean;
  canManage: boolean;
  stripeOn: boolean;
  priceResolvable: boolean;
}): PlanPricingCardCta {
  if (args.isCurrent) return { mode: "current" };

  if (args.slug === "free") {
    return {
      mode: "disabled",
      reason:
        "You’re on a paid subscription. Use Customer Portal to downgrade or cancel.",
    };
  }

  if (!args.onFreeTier) {
    return {
      mode: "disabled",
      reason: "Use Customer Portal to switch between paid options or cancel.",
    };
  }

  if (!args.canManage) {
    return {
      mode: "disabled",
      reason: "Ask an owner or admin with Billing permission to subscribe.",
    };
  }
  if (!args.stripeOn) {
    return {
      mode: "disabled",
      /** Shown only as disabled control; banner above explains Stripe. */
      reason: "",
    };
  }
  if (!args.priceResolvable) {
    return {
      mode: "disabled",
      reason:
        "Set plans.stripe_price_id or STRIPE_PRO_PRICE_ID / STRIPE_BUSINESS_PRICE_ID.",
    };
  }
  return { mode: "subscribe" };
}

function buildPlanCards(
  rows: Array<{
    plan: typeof plans.$inferSelect;
    unitAmount: number | null;
    currency: string | null;
  }>,
  currentSlug: string | null,
  canManage: boolean,
): PlanPricingCardModel[] {
  const stripeOn = isStripeSecretConfigured();
  const onFree = currentSlug === "free";

  return rows.map(({ plan, unitAmount, currency }) => {
    const cat = catalogForPlanSlug(plan.slug);
    const hasSynced = unitAmount != null && currency;
    const priceLine = hasSynced
      ? formatCents(unitAmount, currency)
      : cat.priceLabel;
    const periodLine = hasSynced
      ? "Billed monthly (from Stripe)"
      : cat.pricePeriod;
    const isCurrent = plan.slug === currentSlug;
    const priceResolvable = Boolean(resolveStripePriceIdForPlan(plan));

    const cta = resolvePlanCta({
      slug: plan.slug,
      isCurrent,
      onFreeTier: onFree,
      canManage,
      stripeOn,
      priceResolvable,
    });

    return {
      slug: plan.slug,
      name: plan.name,
      description: cat.description,
      priceLine,
      periodLine,
      features: cat.features,
      cta,
    };
  });
}

async function BillingPageData({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const checkout = typeof sp.checkout === "string" ? sp.checkout : undefined;
  const canceled = sp.canceled === "1" || sp.canceled === "true";
  const err = typeof sp.error === "string" ? sp.error : undefined;

  if (!viewer) {
    return (
      <DashboardPanel title="Billing" description="Sign in to continue.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No user session.</p>
      </DashboardPanel>
    );
  }

  if (!viewer.profile?.organizationId) {
    return (
      <DashboardPanel title="Billing" description="Your plan and Stripe subscription.">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Complete onboarding to use billing.
        </p>
      </DashboardPanel>
    );
  }

  const userId = viewer.user.id;
  const organizationId = viewer.profile.organizationId;
  const db = getDb();
  const permissionCodes = await getPermissionCodesForUser(userId);
  const subscription = await getOrganizationSubscription(organizationId);
  const customerRow = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.organization_id, organizationId))
    .limit(1);

  const planPriceRows = sortJoinedPlansByBillingOrder(
    await db
      .select({
        plan: plans,
        unitAmount: prices.unit_amount,
        currency: prices.currency,
      })
      .from(plans)
      .leftJoin(prices, eq(plans.stripe_price_id, prices.id)),
  );

  const canRead = permissionCodes.has("billing:read");
  const canManage = permissionCodes.has("billing:manage");
  const stripeConfigured = isStripeSecretConfigured();
  const hasCustomer = Boolean(customerRow[0]);
  const currentSlug = viewer.profile.organizationPlanSlug ?? "free";

  const banner =
    messageForQuery(err) ??
    (checkout === "success" ? messageForQuery("success") : null) ??
    (canceled ? messageForQuery("canceled") : null);

  const cards = buildPlanCards(
    planPriceRows,
    currentSlug,
    canManage,
  );

  return (
    <div className="flex flex-col gap-6">
      {banner ? (
        <p
          className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          role="status"
        >
          {banner}
        </p>
      ) : null}

        <DashboardPanel
          title="Plans"
          description="Subscription for the active project. Live prices appear when Stripe prices are linked or synced."
        >
          {!canRead ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You don’t have permission to view billing.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {!stripeConfigured ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Stripe isn’t connected yet — plans still show below. Add{" "}
                  <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800 dark:text-zinc-200">
                    STRIPE_SECRET_KEY
                  </code>{" "}
                  and price IDs to enable checkout.
                </p>
              ) : null}
              <BillingPlansWithPromo cards={cards} />
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Current subscription"
          description="Stripe subscription for this project, synced via webhooks."
        >
          {!canRead ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You don’t have permission to view billing.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <ProfileDetailRows
                rows={[
                  {
                    label: "Current plan",
                    value: viewer.profile.organizationPlan ?? "—",
                  },
                  {
                    label: "Stripe subscription",
                    value: subscription
                      ? `${subscription.status} · ${subscription.id}`
                      : "None (within free / trialing limits)",
                  },
                  ...(subscription?.price
                    ? [
                        {
                          label: "Price",
                          value: subscription.price.id,
                        },
                      ]
                    : []),
                  ...(subscription?.product
                    ? [
                        {
                          label: "Product",
                          value: subscription.product.name,
                        },
                      ]
                    : []),
                ]}
              />

              {canManage ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  {stripeConfigured && hasCustomer ? (
                    <form action={openCustomerPortalAction}>
                      <Button type="submit" variant="outline" size="sm">
                        Open Stripe customer portal
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      Customer portal appears after the first successful checkout
                      (Stripe customer created).
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Ask an owner or admin to open the customer portal.
                </p>
              )}
            </div>
          )}
        </DashboardPanel>
    </div>
  );
}

export default function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DashboardPageShell title="Billing">
      <BillingPageData searchParams={searchParams} />
    </DashboardPageShell>
  );
}
