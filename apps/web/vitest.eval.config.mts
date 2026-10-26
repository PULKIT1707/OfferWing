import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Golden-set evals (evals/*.eval.ts). Separate from `npm test` because live runs call real AI APIs.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["evals/**/*.eval.ts"], environment: "node" },
});
