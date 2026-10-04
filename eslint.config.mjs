import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  { settings: { next: { rootDir: "apps/web/" } } },
  globalIgnores([
    "**/.next/**",
    "**/.open-next/**",
    "**/.wrangler/**",
    "**/cloudflare-env.d.ts",
    "**/worker-configuration.d.ts",
    "**/next-env.d.ts",
    "target/**",
    ".artifacts/**",
    "node_modules/**",
  ]),
]);
