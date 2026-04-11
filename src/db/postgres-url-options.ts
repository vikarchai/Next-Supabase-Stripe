import type postgres from "postgres";

/** Keep in sync with connection rules in `getDb()` — used by CLI migrate as well. */
export function postgresOptionsForUrl(
  databaseUrl: string,
): postgres.Options<Record<string, postgres.PostgresType>> {
  const isSupabaseHost =
    databaseUrl.includes("supabase.co") || databaseUrl.includes("supabase.com");

  let usesTransactionPooler = databaseUrl.includes("pooler.supabase.com");
  if (!usesTransactionPooler) {
    try {
      const normalized = databaseUrl.replace(/^postgres(ql)?:/i, "http:");
      const u = new URL(normalized);
      usesTransactionPooler = u.port === "6543";
    } catch {
      usesTransactionPooler = /:6543(\/|\?|$)/.test(databaseUrl);
    }
  }

  const poolMaxEnv = process.env.DATABASE_POOL_MAX?.trim();
  const poolMaxParsed = poolMaxEnv
    ? Number.parseInt(poolMaxEnv, 10)
    : Number.NaN;
  /**
   * Supabase: `max: 1` + several concurrent Drizzle queries in one request often
   * deadlocks or hangs with postgres.js. Default to 2; set DATABASE_POOL_MAX=1 if
   * your pooler only allows a single session.
   */
  const max =
    Number.isFinite(poolMaxParsed) && poolMaxParsed > 0
      ? poolMaxParsed
      : isSupabaseHost
        ? 2
        : undefined;

  return {
    ssl: isSupabaseHost ? "require" : undefined,
    prepare: usesTransactionPooler ? false : undefined,
    max,
  };
}
