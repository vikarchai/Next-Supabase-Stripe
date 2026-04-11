import { isUnlimitedNumeric, PLAN_LIMITS } from "@/lib/billing/plan-limits";

const F = PLAN_LIMITS.FREE.limits;
const S = PLAN_LIMITS.STARTER.limits;
const B = PLAN_LIMITS.BUSINESS.limits;

function projectPhrase(n: number): string {
  if (isUnlimitedNumeric(n)) return "Unlimited projects";
  return `${n} project${n === 1 ? "" : "s"}`;
}

function membersOrgPhrase(n: number): string {
  if (isUnlimitedNumeric(n)) return "Unlimited members in the organization";
  return `Up to ${n} members in the organization`;
}

/** Marketing copy for plan cards (shown even when Stripe is disconnected). */
export const PLAN_CARD_COPY = {
  free: {
    description: `${projectPhrase(F.projects)}. ${membersOrgPhrase(F.members)}. ${F.items} deals · ${F.storage} MB storage. ${F.analyticsDays}-day dashboard analytics.`,
    priceLabel: "$0",
    pricePeriod: "forever",
    features: [
      projectPhrase(F.projects),
      membersOrgPhrase(F.members),
      `${F.items} deals · ${F.storage} MB storage`,
      `${F.analyticsDays}-day dashboard analytics`,
    ],
  },
  pro_starter: {
    description: `${projectPhrase(S.projects)}. ${membersOrgPhrase(S.members)}. ${S.items} deals · ${S.storage} MB storage.`,
    priceLabel: `$${PLAN_LIMITS.STARTER.price}`,
    pricePeriod: "per month",
    features: [
      projectPhrase(S.projects),
      membersOrgPhrase(S.members),
      `${S.items} deals · ${S.storage} MB storage`,
      `${S.analyticsDays}-day analytics`,
    ],
  },
  pro_business: {
    description: `Unlimited projects. Unlimited members in the organization. Unlimited deals · ${B.storage} MB storage.`,
    priceLabel: `$${PLAN_LIMITS.BUSINESS.price}`,
    pricePeriod: "per month",
    features: [
      "Unlimited projects",
      "Unlimited members in the organization",
      `Unlimited deals · ${B.storage} MB storage`,
      "Full analytics history · no branding footer",
    ],
  },
} as const;

export type PlanCatalogSlug = keyof typeof PLAN_CARD_COPY;

function normalizePlanCatalogSlug(slug: string): PlanCatalogSlug | null {
  if (slug in PLAN_CARD_COPY) return slug as PlanCatalogSlug;
  return null;
}

export function catalogForPlanSlug(slug: string) {
  const key = normalizePlanCatalogSlug(slug);
  if (key) {
    return PLAN_CARD_COPY[key];
  }
  return {
    description: "",
    priceLabel: "—",
    pricePeriod: "",
    features: [] as string[],
  };
}
