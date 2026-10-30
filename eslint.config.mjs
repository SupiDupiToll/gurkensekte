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
    // Cloudflare/OpenNext-Artefakte (Worker-Bundle, wrangler-State):
    ".open-next/**",
    ".wrangler/**",
    // Vendored Agent-Skills (Fremdcode, z. B. scroll-craft):
    ".agents/**",
    // Kopie der scroll-craft-Engine als statisches Asset (Fremdcode):
    "public/scrollcraft/**",
  ]),
]);

export default eslintConfig;
