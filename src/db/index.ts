import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { postgresOptionsForUrl } from "./postgres-url-options";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let dbInstance: Database | null = null;

/**
 * Lazy Drizzle initializer.
 *
 * Why lazy?
 * Next.js can import server modules during build (for type checks / page
 * analysis). In a template, `DATABASE_URL` might not exist yet, so we avoid
 * throwing at import-time.
 */
export function getDb(): Database {
  if (dbInstance) return dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL. Add it to your .env.local file.");
  }

  const client = postgres(databaseUrl, postgresOptionsForUrl(databaseUrl));

  dbInstance = drizzle(client, { schema }) as Database;
  return dbInstance;
}

// Convenience re-exports for query code.
export const {
  customers,
  deals,
  projects,
  organizations,
  organization_invites,
  plans,
  prices,
  products,
  profiles,
  permissions,
  promo_codes,
  promo_redemptions,
  roles,
  role_permissions,
  subscriptions,
} = schema;

