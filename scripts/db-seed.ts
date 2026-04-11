/**
 * Idempotent: `plans` + global `permissions`. Per-org roles come from signup (`syncOrgStandardRolePermissions`).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncGlobalReferenceData } from "../src/db/role-seed";
import { formatDatabaseTarget, loadEnvLocalFile } from "./load-env-local";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
loadEnvLocalFile(path.join(root, ".env.local"));

if (!process.env.DATABASE_URL?.trim()) {
  console.error("Missing DATABASE_URL. Set it in .env.local.");
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) console.error(`Database: ${formatDatabaseTarget(url)}`);
  await syncGlobalReferenceData();
  console.error("Seed finished (plans + permissions).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
