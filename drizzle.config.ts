import { defineConfig } from "drizzle-kit";
import fs from "node:fs";

/**
 * drizzle-kit runs `drizzle.config.ts` in Node without Next.js loading `.env.local`.
 * We load `.env.local` manually before reading `process.env.DATABASE_URL`.
 */
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    // Remove optional wrapping quotes: KEY="value" or KEY='value'
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(".env.local");

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL. Add it to your .env.local file.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

