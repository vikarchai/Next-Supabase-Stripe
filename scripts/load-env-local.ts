import fs from "node:fs";

/**
 * Load `.env.local` like drizzle.config: values from the file win (override process.env).
 * So `npm run db:migrate` hits the DB from the project, not a stale shell `DATABASE_URL`.
 */
export function loadEnvLocalFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

/** Safe one-line target for logs (no password). */
export function formatDatabaseTarget(urlStr: string): string {
  try {
    const u = new URL(urlStr.replace(/^postgres(ql)?:/i, "http:"));
    const db = u.pathname.replace(/^\//, "") || "(default)";
    return `${u.hostname}${u.port ? `:${u.port}` : ""} · database “${db}”`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
