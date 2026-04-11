import path from "path";
import { fileURLToPath } from "url";

import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = defineConfig([
  // Convert legacy `extends`-based configs into flat config.
  ...compat.extends(
    "eslint-config-next/core-web-vitals",
    "eslint-config-next/typescript",
  ),

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
