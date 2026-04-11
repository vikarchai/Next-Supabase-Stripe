import type { InferSelectModel } from "drizzle-orm";

import type { deals } from "@/db/schema";

export type DealStatus = InferSelectModel<typeof deals>["status"];

export const DEAL_STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
];

const STATUS_ORDER: DealStatus[] = DEAL_STATUS_OPTIONS.map((o) => o.value);

/** Next status in lifecycle order; wraps from archived to draft. */
export function nextDealStatus(current: DealStatus): DealStatus {
  const i = STATUS_ORDER.indexOf(current);
  const idx = i === -1 ? 0 : i;
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]!;
}

export function dealStatusLabel(status: DealStatus): string {
  return DEAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}
