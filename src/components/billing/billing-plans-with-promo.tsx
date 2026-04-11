"use client";

import { useState, useTransition } from "react";

import { verifyPromoCodeAction } from "@/actions/billing";
import {
  PlanPricingCards,
  type PlanPricingCardModel,
} from "@/components/billing/plan-pricing-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Applied = { id: string; summary: string; description: string };

export function BillingPlansWithPromo({
  cards,
}: {
  cards: PlanPricingCardModel[];
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    setError(null);
    startTransition(async () => {
      const r = await verifyPromoCodeAction(code);
      if (r.status === "error") {
        setApplied(null);
        setError(r.message);
        return;
      }
      if (r.status === "applied") {
        setApplied({
          id: r.id,
          summary: r.summary,
          description: r.description,
        });
        setError(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <Label htmlFor="billing-promo" className="text-sm font-medium">
          Promo code
        </Label>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Apply before you click Subscribe on a paid plan. The discount applies
          to the first invoice (Stripe coupon, once).
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="billing-promo"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. LAUNCH20"
              autoCapitalize="characters"
              autoComplete="off"
              disabled={pending}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void apply();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => void apply()}
            >
              Apply
            </Button>
            {applied ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setApplied(null);
                  setError(null);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        {applied ? (
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium">{applied.summary}</span>
            {applied.description !== "—" ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                {" "}
                · {applied.description}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <PlanPricingCards cards={cards} appliedPromo={applied} />
    </div>
  );
}
