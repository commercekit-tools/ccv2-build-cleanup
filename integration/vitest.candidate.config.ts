import { defineConfig } from "vitest/config";
const candidate = process.env.CLEANUP_CANDIDATE_PACKAGE;
if (!candidate)
  throw new Error(
    "Set CLEANUP_CANDIDATE_PACKAGE to the unpacked exact-source candidate package.",
  );
export default defineConfig({
  resolve: {
    alias: {
      "@commercekit-tools/notification-contract": candidate + "/dist/index.js",
    },
  },
  test: {
    include: ["integration/notification-adapter.candidate.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/reporting/notification.ts"],
      reporter: ["text"],
      thresholds: { statements: 98, branches: 98, functions: 98, lines: 98 },
    },
  },
});
