function formatPointNoYear(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const midnight =
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  if (midnight) return datePart;
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart}, ${timePart}`;
}

/** Single line, no year: `Apr 5 - May 12` or `Apr 5, 3:00 PM - May 12`. */
export function formatDealTermRange(
  startIso: string | null,
  endIso: string | null,
): string {
  const a = startIso ? formatPointNoYear(startIso) : null;
  const b = endIso ? formatPointNoYear(endIso) : null;
  if (!a && !b) return "—";
  if (a && b) return `${a} - ${b}`;
  return a ?? b ?? "—";
}
