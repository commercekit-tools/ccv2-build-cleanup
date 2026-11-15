import { expect, it } from "vitest";
import metadata from "@commercekit-tools/notification-contract/package.json" with { type: "json" };
import schema from "@commercekit-tools/notification-contract/schema" with { type: "json" };
import { parseNotificationEventJson } from "@commercekit-tools/notification-contract";
import { createCleanupNotification } from "../../src/reporting/notification.js";

it("emits a validated event using the exact published 0.0.6 registry dependency", () => {
  expect(metadata.version).toBe("0.0.6");
  expect(schema.properties.eventType.enum).toContain(
    "ccv2.build-cleanup.completed",
  );
  const text = createCleanupNotification(
    {
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
    },
    { GITHUB_REPOSITORY: "test/repo", GITHUB_RUN_ID: "42" },
  );
  expect(Buffer.byteLength(text)).toBeLessThanOrEqual(65536);
  const event = parseNotificationEventJson(text);
  expect(event).toMatchObject({
    schemaVersion: 1,
    eventType: "ccv2.build-cleanup.completed",
    status: "success",
    occurredAt: "2026-11-13T00:00:00Z",
    source: { component: "ccv2-build-cleanup" },
    context: { runUrl: "https://github.com/test/repo/actions/runs/42" },
  });
  expect(event.data).toEqual({
    mode: "dry-run",
    subscriptionCode: "test",
    retentionDays: 30,
    keepLatest: 10,
    cleanupStatus: "dry-run",
    scannedCount: 0,
    eligibleCount: 0,
    plannedCount: 0,
    deletionRequestedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    unknownCount: 0,
    deferredCount: 0,
    protectedCount: 0,
    blockedCount: 0,
    durationMs: 1,
  });
});
