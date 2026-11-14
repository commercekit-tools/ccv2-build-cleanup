import { describe, expect, it, vi } from "vitest";
import { parseNotificationEventJson } from "@commercekit-tools/notification-contract";
import { createCleanupNotification } from "../src/reporting/notification.js";
const base = {
  runStartedAt: "2026-11-13T00:00:00Z",
  durationMs: 1,
  dryRun: true,
  scope: { subscriptionCode: "sandbox" },
  policy: { retentionDays: 30, keepLatest: 10 },
  counts: {
    scanned: 10,
    eligible: 3,
    planned: 2,
    deletionRequested: 0,
    skipped: 7,
    failed: 0,
    unknown: 0,
    deferred: 1,
  },
};
describe("adapter against exact packed shared candidate", () => {
  for (const status of [
    "dry-run",
    "no-op",
    "success",
    "blocked",
    "partial-failure",
    "failed",
    "outcome-unknown",
  ])
    for (const dryRun of [true, false])
      it(`${status} ${dryRun}`, () => {
        const text = createCleanupNotification({ ...base, status, dryRun });
        expect(text).toBeDefined();
        const event = parseNotificationEventJson(text!);
        expect(event.eventType).toBe("ccv2.build-cleanup.completed");
        expect(event.status).toBe(
          ["dry-run", "no-op", "success"].includes(status)
            ? "success"
            : "failure",
        );
        expect(event.data).toMatchObject({
          mode: dryRun ? "dry-run" : "apply",
          scannedCount: 10,
          deferredCount: 1,
        });
      });
  it("sanitizes projected error/scope/context through shared primitives", () => {
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
    expect(parseNotificationEventJson(text!).data).toMatchObject({
      error: { code: "[REDACTED]-code" },
      applicationCode: "[REDACTED]-app",
    });
  });
});

for (const omit of [true, false]) {
  it(`handles absent or non-callable factory capability (${omit})`, async () => {
    vi.resetModules();
    vi.doMock("@commercekit-tools/notification-contract", async (load) => {
      const actual = await load<Record<string, unknown>>();
      const copy = { ...actual };
      if (omit) delete copy.createBuildCleanupEvent;
      else copy.createBuildCleanupEvent = undefined;
      return copy;
    });
    try {
      const { createCleanupNotification: older } =
        await import("../src/reporting/notification.js");
      expect(older({ ...base, status: "dry-run" })).toBeUndefined();
    } finally {
      vi.doUnmock("@commercekit-tools/notification-contract");
      vi.resetModules();
    }
  });
}
