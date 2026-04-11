/**
 * Canonical plan tiers and limits (must stay aligned with `plans.slug` in the DB).
 * Numeric limits: `-1` means unlimited (except booleans).
 */
export const PLAN_LIMITS = {
  FREE: {
    id: "free",
    name: "Free",
    price: 0,
    type: "subscription" as const,
    limits: {
      projects: 1,
      members: 2,
      items: 5,
      storage: 50,
      customDomains: 0,
      analyticsDays: 7,
      brandingRemoval: false,
    },
  },
  STARTER: {
    id: "pro_starter",
    name: "Starter Pro",
    price: 15,
    type: "subscription" as const,
    limits: {
      projects: 10,
      members: 10,
      items: 100,
      storage: 1024,
      customDomains: 1,
      analyticsDays: 90,
      brandingRemoval: true,
    },
  },
  BUSINESS: {
    id: "pro_business",
    name: "Business Elite",
    price: 49,
    type: "subscription" as const,
    limits: {
      projects: -1,
      members: -1,
      items: -1,
      storage: 10240,
      customDomains: 10,
      analyticsDays: -1,
      brandingRemoval: true,
    },
  },
} as const;

export type PlanLimits = (typeof PLAN_LIMITS.FREE)["limits"];

export function isUnlimitedNumeric(n: number): boolean {
  return n < 0;
}

/** Resolve catalog entry from DB plan slug (`plans.slug`). */
export function getPlanDefinitionBySlug(slug: string | null | undefined) {
  const s = slug ?? "free";
  if (s === "free") return PLAN_LIMITS.FREE;
  if (s === "pro_starter") return PLAN_LIMITS.STARTER;
  if (s === "pro_business") return PLAN_LIMITS.BUSINESS;
  return PLAN_LIMITS.FREE;
}

export function analyticsCutoffDate(utcNow: Date, analyticsDays: number): Date | null {
  if (isUnlimitedNumeric(analyticsDays)) return null;
  if (analyticsDays <= 0) return utcNow;
  const d = new Date(utcNow);
  d.setUTCDate(d.getUTCDate() - analyticsDays);
  return d;
}
