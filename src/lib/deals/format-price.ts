/**
 * Parse free-text amount (e.g. "1200000", "1,200,000", "$500.50") and format as USD
 * with grouping. Fractional cents (.50) are shown; whole dollars omit ".00".
 */
export function formatDealPriceDisplay(note: string | null): string | null {
  if (!note?.trim()) return null;
  const raw = note.trim();
  const stripped = raw.replace(/^\$/u, "").trim();
  const normalized = stripped.replace(/,/g, "").replace(/\s/g, "");
  if (normalized === "") {
    return raw.startsWith("$") ? raw : `$${raw}`;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    return raw.startsWith("$") ? raw : `$${raw}`;
  }
  const cents = Math.round(n * 100);
  const dollars = cents / 100;
  const hasCents = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(dollars);
}
