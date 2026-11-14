import { defineConfig } from "vitest/config";
const candidate = process.env.CLEANUP_CANDIDATE_PACKAGE;
export default defineConfig({
  test: {
    projects: [
      { test: { name: "published", include: ["tests/**/*.test.ts"] } },
      ...(candidate
        ? [
            {
              resolve: {
                alias: {
                  "@commercekit-tools/notification-contract":
                    candidate + "/dist/index.js",
                },
              },
              test: {
                name: "candidate",
                include: ["integration/notification-adapter.candidate.test.ts"],
              },
            },
          ]
        : []),
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: { lines: 98, statements: 98, functions: 98, branches: 98 },
    },
  },
});
