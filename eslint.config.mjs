import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Shopify extensions are a separate project: their own package, their own
    // React major, their own tsconfig, and built by the Shopify CLI rather
    // than by Next. `npm run typecheck` still checks their source through
    // `extensions/track-order/tsconfig.json`; what is ignored here is the
    // bundle the CLI writes next to it.
    "extensions/**",
    // Bundle the Shopify CLI writes when building or deploying.
    ".shopify/**",
  ]),
]);

export default eslintConfig;
