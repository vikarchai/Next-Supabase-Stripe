import { startPlanCheckoutAction } from "@/actions/billing";
import { Button } from "@/components/ui/button";

export type PlanPricingCardCta =
  | { mode: "current" }
  | { mode: "subscribe" }
  | { mode: "disabled"; reason: string };

export type PlanPricingCardModel = {
  slug: string;
  name: string;
  description: string;
  priceLine: string;
  periodLine: string;
  features: readonly string[];
  cta: PlanPricingCardCta;
};

export type AppliedPromoForCheckout = {
  id: string;
  summary: string;
};

type PlanPricingCardsProps = {
  cards: PlanPricingCardModel[];
  /** When set, subscribe forms include `promo_code_id` for Stripe checkout. */
  appliedPromo?: AppliedPromoForCheckout | null;
};

export function PlanPricingCards({
  cards,
  appliedPromo = null,
}: PlanPricingCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.slug}
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{card.name}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{card.description}</p>
            </div>
          </div>
          <div className="mb-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {card.priceLine}
            </p>
            {card.periodLine ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{card.periodLine}</p>
            ) : null}
          </div>
          <ul className="mb-6 flex flex-1 flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            {card.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            {card.cta.mode === "current" ? (
              <Button type="button" className="w-full" disabled variant="secondary">
                Current plan
              </Button>
            ) : null}
            {card.cta.mode === "subscribe" ? (
              <form action={startPlanCheckoutAction} className="w-full">
                <input type="hidden" name="plan_slug" value={card.slug} />
                {appliedPromo ? (
                  <input
                    type="hidden"
                    name="promo_code_id"
                    value={appliedPromo.id}
                  />
                ) : null}
                <Button type="submit" className="w-full">
                  {appliedPromo
                    ? `Subscribe (${appliedPromo.summary})`
                    : "Subscribe"}
                </Button>
              </form>
            ) : null}
            {card.cta.mode === "disabled" ? (
              <div className="space-y-2">
                <Button type="button" className="w-full" disabled variant="outline">
                  Not available
                </Button>
                {card.cta.reason ? (
                  <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                    {card.cta.reason}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
