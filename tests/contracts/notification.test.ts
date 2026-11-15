import { describe, expect, it } from "vitest";
import { parseNotificationEventJson } from "@commercekit-tools/notification-contract";
import {
  createCleanupNotification,
  type CleanupNotificationInput,
} from "../../src/reporting/notification.js";
import {
  captureInputValues,
  cleanupInputNames,
  snapshotInputContext,
} from "../../src/reporting/input-context.js";
import { Sanitizer } from "../../src/reporting/result.js";
import { inputs, rawInputs } from "../fixtures/builds.js";

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

function parseCleanup(text: string) {
  const event = parseNotificationEventJson(text);
  if (event.eventType !== "ccv2.build-cleanup.completed")
    throw new Error("Expected cleanup event.");
  return event;
}
function settings(overrides: Record<string, string> = {}) {
  const safe = new Sanitizer(() => {});
  const raw = captureInputValues(
    (name) => ({ ...rawInputs, ...overrides })[name] ?? "",
    (secret) => safe.add(secret),
  );
  return snapshotInputContext(raw, inputs(overrides), (value, max) =>
    safe.input(value, max),
  );
}

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
      it(`projects legacy ${status} in ${dryRun ? "dry-run" : "apply"} mode without inventing warning evidence`, () => {
        const counts = {
          ...base.counts,
          deletionRequested: dryRun ? 0 : accepted,
          failed: dryRun ? 0 : failed,
          unknown: dryRun ? 0 : unknown,
          skipped: dryRun ? 10 : 10 - accepted - failed - unknown,
        };
        const event = parseCleanup(
          createCleanupNotification({ ...base, status, dryRun, counts }),
        );
        expect(event.status).toBe(eventStatus);
        expect(event.source.component).toBe("ccv2-build-cleanup");
        expect(event.data).toMatchObject({
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
          protectedCount: 0,
          blockedCount: 0,
          durationMs: 1200,
        });
        expect(event.data).not.toHaveProperty("deletedCount");
        expect(event.data).not.toHaveProperty("inputs");
        if (eventStatus === "failure")
          expect(event.data.error?.message).toBeTruthy();
        else expect(event.data.error).toBeUndefined();
      });

  it("preserves every effective input and accepted request count for successful apply", () => {
    const inputContext = settings({
      "application-code": "app",
      "dry-run": "false",
      "max-deletions": "7",
      "timeout-minutes": "3",
      "continue-on-delete-error": "true",
      "exclude-build-codes": "excluded-1, excluded-2\nexcluded-1",
    });
    const event = parseCleanup(
      createCleanupNotification({
        ...base,
        ...inputContext,
        status: "success",
        dryRun: false,
        completeness: { inventory: true, protection: true, eligibility: true },
        decisions: [
          { disposition: "deletion-requested", reasons: [] },
          { disposition: "deletion-requested", reasons: [] },
          { disposition: "protected", reasons: ["retained-latest"] },
        ],
        counts: {
          ...base.counts,
          deletionRequested: 2,
          skipped: 8,
          protected: 4,
        },
      }),
    );
    expect(event.status).toBe("success");
    expect(event.data.deletionRequestedCount).toBe(2);
    expect(event.data).not.toHaveProperty("deletedCount");
    expect(event.data.protectedCount).toBe(4);
    expect(event.data.blockedCount).toBe(0);
    expect(event.data.inputsValidated).toBe(true);
    expect(event.data.inputsTruncated).toBe(false);
    expect(Object.keys(event.data.inputs!)).toEqual(cleanupInputNames);
    expect(event.data.inputs).toMatchObject({
      "token-endpoint": "[REDACTED]",
      "client-id": "[REDACTED]",
      "client-secret": "[REDACTED]",
      resource: "[REDACTED]",
      "api-base-url": "https://portalapi.commerce.ondemand.com/",
      "application-code": "app",
      "dry-run": "false",
      "max-deletions": "7",
      "timeout-minutes": "3",
      "continue-on-delete-error": "true",
      "exclude-build-codes": "excluded-1, excluded-2",
    });
    expect(event.data.error).toBeUndefined();
    expect(event.data.issues).toBeUndefined();
  });

  it("emits a real shared warning only for blocked dry-run with verified inventory", () => {
    const value: CleanupNotificationInput = {
      ...base,
      ...settings(),
      status: "blocked",
      completeness: { inventory: true, protection: false, eligibility: false },
      decisions: Array.from({ length: 3 }, () => ({
        disposition: "blocked",
        reasons: ["eligibility-unverified"],
      })),
      counts: {
        ...base.counts,
        eligible: 0,
        planned: 0,
        deferred: 0,
        protected: 7,
      },
    };
    const event = parseCleanup(createCleanupNotification(value));
    expect(event.status).toBe("warning");
    expect(event.data).toMatchObject({
      mode: "dry-run",
      cleanupStatus: "blocked",
      deletionRequestedCount: 0,
      protectedCount: 7,
      blockedCount: 3,
      inputsValidated: true,
    });
    expect(event.data.issues?.map((issue) => issue.code)).toEqual([
      "eligibility-unverified",
      "protection-unverified",
    ]);
    expect(event.data.issues?.[0]?.message).toContain("four-hour");
    expect(event.data.error).toBeUndefined();
    const apply = parseCleanup(
      createCleanupNotification({ ...value, dryRun: false }),
    );
    expect(apply.status).toBe("failure");
    expect(apply.data.error).toMatchObject({
      code: "cleanup-blocked",
      message: expect.stringContaining("Deletion requests are blocked"),
    });
  });

  it("retains actionable failure explanations, HTTP status and inputs", () => {
    const event = parseCleanup(
      createCleanupNotification({
        ...base,
        ...settings(),
        status: "failed",
        error: { code: "authorization-failure", status: 403 },
      }),
    );
    expect(event.status).toBe("failure");
    expect(event.data.error).toEqual({
      code: "authorization-failure",
      message:
        "CCv2 authentication or authorization failed. Check the technical-user permissions. HTTP 403.",
    });
    expect(Object.keys(event.data.inputs!)).toEqual(cleanupInputNames);
  });

  it("reports invalid supplied settings and the exact safe corrective hint", () => {
    const safe = new Sanitizer(() => {});
    const raw = captureInputValues(
      (name) =>
        ({ ...rawInputs, "retention-days": "not-an-integer" })[name] ?? "",
      (secret) => safe.add(secret),
    );
    const event = parseCleanup(
      createCleanupNotification({
        ...base,
        ...snapshotInputContext(raw, undefined, (value, max) =>
          safe.input(value, max),
        ),
        status: "failed",
        error: { code: "invalid-input", input: "retention-days" },
      }),
    );
    expect(event.status).toBe("failure");
    expect(event.data.inputsValidated).toBe(false);
    expect(event.data.inputs?.["retention-days"]).toBe("not-an-integer");
    expect(event.data.error?.message).toContain(
      "Invalid retention-days input.",
    );
    expect(event.data.error?.message).toContain("integer from 1 to 36500");
    expect(event.data.error?.message).toContain("No cleanup was started.");
  });

  it("sanitizes known secrets across inputs, error code, scope and context", () => {
    const secret = "sensitive-marker-fixture";
    const inputContext = settings();
    const eventText = createCleanupNotification(
      {
        ...base,
        ...inputContext,
        inputs: {
          ...inputContext.inputs,
          "application-code": `${secret}-app`,
          "exclude-build-codes": `build-${secret}`,
        },
        status: "failed",
        scope: {
          subscriptionCode: `${secret}-sub`,
          applicationCode: `${secret}-app`,
        },
        error: { code: `${secret}-code` },
      },
      { GITHUB_ACTOR: `${secret}-actor`, GITHUB_RUN_ATTEMPT: "2" },
      [secret],
    );
    expect(eventText).not.toContain(secret);
    const event = parseCleanup(eventText);
    expect(event.data).toMatchObject({
      subscriptionCode: "[REDACTED]-sub",
      applicationCode: "[REDACTED]-app",
      inputs: {
        "application-code": "[REDACTED]-app",
        "exclude-build-codes": "build-[REDACTED]",
      },
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

  it("marks long input values truncated whether producer metadata is present or absent", () => {
    const inputContext = settings({
      "exclude-build-codes": Array.from(
        { length: 1000 },
        (_, index) => `build-${index}`,
      ).join(","),
    });
    const existingFlag = parseCleanup(
      createCleanupNotification({
        ...base,
        ...inputContext,
        status: "dry-run",
      }),
    );
    expect(existingFlag.data.inputsTruncated).toBe(true);
    expect(existingFlag.data.inputs?.["exclude-build-codes"]).toMatch(
      /… \[truncated\]$/,
    );
    const inferredFlag = parseCleanup(
      createCleanupNotification({
        ...base,
        status: "dry-run",
        inputs: {
          ...settings().inputs,
          "exclude-build-codes": "x".repeat(1000),
        },
      }),
    );
    expect(inferredFlag.data.inputsValidated).toBe(false);
    expect(inferredFlag.data.inputsTruncated).toBe(true);
    expect(inferredFlag.data.inputs?.["exclude-build-codes"]).toHaveLength(256);
    expect(Buffer.byteLength(JSON.stringify(inferredFlag))).toBeLessThanOrEqual(
      65536,
    );
  });

  it("includes the bounded reason set for globally incomplete safety evidence", () => {
    const event = parseCleanup(
      createCleanupNotification({
        ...base,
        status: "blocked",
        completeness: {
          inventory: false,
          protection: false,
          eligibility: false,
        },
        decisions: [
          {
            disposition: "blocked",
            reasons: ["incomplete-inventory", "eligibility-unverified"],
          },
        ],
      }),
    );
    expect(event.status).toBe("failure");
    expect(event.data.issues?.map((issue) => issue.code)).toEqual([
      "incomplete-inventory",
      "eligibility-unverified",
      "protection-unverified",
    ]);
    expect(event.data.issues).toHaveLength(3);
    expect(event.data.error?.message).toContain(
      "inventory is incomplete or unstable",
    );
  });
});
