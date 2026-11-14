import { expect, it } from "vitest";
import { createCleanupNotification } from "../../src/reporting/notification.js";
it("reports the published contract compatibility gate without mislabeling cleanup", () => {
  expect(
    createCleanupNotification({
      runStartedAt: "2026-11-13T00:00:00Z",
      durationMs: 1,
      status: "dry-run",
      dryRun: true,
      scope: { subscriptionCode: "test" },
      policy: { retentionDays: 30, keepLatest: 10 },
      counts: {
        scanned: 0,
        eligible: 0,
        planned: 0,
        deletionRequested: 0,
        skipped: 0,
        failed: 0,
        unknown: 0,
        deferred: 0,
      },
    }),
  ).toBeUndefined();
});
