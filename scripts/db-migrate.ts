/**
 * Apply SQL migrations using postgres.js + the same Supabase/pooler options as the app.
 *
 * `drizzle-kit migrate` prefers the `pg` driver and does not set `prepare: false` for
 * transaction pooler (port 6543), which often breaks against Supavisor.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { postgresOptionsForUrl } from "../src/db/postgres-url-options";
import { formatDatabaseTarget, loadEnvLocalFile } from "./load-env-local";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
loadEnvLocalFile(path.join(root, ".env.local"));

const databaseUrlRaw = process.env.DATABASE_URL?.trim();
if (!databaseUrlRaw) {
  console.error("Missing DATABASE_URL. Set it in .env.local (see drizzle.config.ts).");
  process.exit(1);
}

/** Narrowed for TypeScript (closures don’t inherit `if` narrowing). */
const databaseUrl = databaseUrlRaw;

const opts = postgresOptionsForUrl(databaseUrl);
const client = postgres(databaseUrl, {
  ...opts,
  max: 1,
  /** Drizzle’s migrator uses IF NOT EXISTS; Postgres still emits NOTICE — hide noise. */
  onnotice: () => {},
});
const db = drizzle(client);
const migrationsFolder = path.join(root, "drizzle");

async function main() {
  console.error(`Database: ${formatDatabaseTarget(databaseUrl)}`);
  console.error(`Applying migrations from ${migrationsFolder} …`);
  await migrate(db, { migrationsFolder });
  console.error(
    "Migrations finished (SQL runs only for tags not yet in drizzle.__drizzle_migrations).",
  );
  const { syncGlobalReferenceData } = await import("../src/db/role-seed");
  await syncGlobalReferenceData();
  console.error(
    "Reference seed finished (plans + permissions). Roles are created per org on signup.",
  );
  console.error("Done (process exits by itself — no keypress needed).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
