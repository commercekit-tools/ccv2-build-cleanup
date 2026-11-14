import { describe, expect, it } from "vitest";
import { parseNotificationEventJson } from "@commercekit-tools/notification-contract";
import { createCleanupNotification } from "../../src/reporting/notification.js";

const base = {
  runStartedAt: "2026-11-13T00:00:00Z",
  durationMs: 1200,
  dryRun: true,
  scope: { subscriptionCode: "sandbox" },
  policy: { retentionDays: 30, keepLatest: 10 },
  counts: {
    scanned: 10,
    eligible: 3,
    planned: 2,
    deletionRequested: 0,
    skipped: 10,
    failed: 0,
    unknown: 0,
    deferred: 1,
  },
};

const cases = [
  ["dry-run", "success", 0, 0, 0],
  ["no-op", "success", 0, 0, 0],
  ["success", "success", 2, 0, 0],
  ["blocked", "failure", 0, 0, 0],
  ["partial-failure", "failure", 1, 1, 0],
  ["failed", "failure", 0, 1, 0],
  ["outcome-unknown", "failure", 0, 0, 1],
] as const;

describe("notification adapter against the published shared contract", () => {
  for (const [status, eventStatus, accepted, failed, unknown] of cases)
    for (const dryRun of [true, false])
      it(`projects ${status} in ${dryRun ? "dry-run" : "apply"} mode`, () => {
        const counts = {
          ...base.counts,
          deletionRequested: dryRun ? 0 : accepted,
          failed: dryRun ? 0 : failed,
          unknown: dryRun ? 0 : unknown,
          skipped: dryRun ? 10 : 10 - accepted - failed - unknown,
        };
        const text = createCleanupNotification({
          ...base,
          status,
          dryRun,
          counts,
        });
        const event = parseNotificationEventJson(text);
        expect(event.eventType).toBe("ccv2.build-cleanup.completed");
        expect(event.status).toBe(eventStatus);
        expect(event.source.component).toBe("ccv2-build-cleanup");
        expect(event.data).toEqual({
          mode: dryRun ? "dry-run" : "apply",
          subscriptionCode: "sandbox",
          retentionDays: 30,
          keepLatest: 10,
          cleanupStatus: status,
          scannedCount: 10,
          eligibleCount: 3,
          plannedCount: 2,
          deletionRequestedCount: counts.deletionRequested,
          skippedCount: counts.skipped,
          failedCount: counts.failed,
          unknownCount: counts.unknown,
          deferredCount: 1,
          durationMs: 1200,
        });
        expect(event.data).not.toHaveProperty("deletedCount");
      });

  it("sanitizes projected error, scope and context through shared primitives", () => {
    const text = createCleanupNotification(
      {
        ...base,
        status: "failed",
        scope: {
          subscriptionCode: "secret-sub",
          applicationCode: "secret-app",
        },
        error: { code: "secret-code" },
      },
      { GITHUB_ACTOR: "secret-actor", GITHUB_RUN_ATTEMPT: "2" },
      ["secret"],
    );
    expect(text).not.toContain("secret");
    const event = parseNotificationEventJson(text);
    expect(event.data).toMatchObject({
      subscriptionCode: "[REDACTED]-sub",
      applicationCode: "[REDACTED]-app",
      error: {
        code: "[REDACTED]-code",
        message:
          "Cleanup did not complete successfully. Review the sanitized report.",
      },
    });
    expect(event.context).toMatchObject({
      actor: "[REDACTED]-actor",
      runAttempt: 2,
    });
  });
});
