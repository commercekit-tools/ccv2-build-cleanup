import { describe, expect, it } from "vitest";
import { describeCleanupOutcome } from "../../src/reporting/cleanup-issues.js";
import type { CleanupNotificationInput } from "../../src/reporting/notification.js";

function cleanup(
  overrides: Partial<CleanupNotificationInput> = {},
  counts: Partial<CleanupNotificationInput["counts"]> = {},
): CleanupNotificationInput {
  return {
    runStartedAt: "2026-11-15T00:00:00Z",
    durationMs: 1000,
    status: "dry-run",
    dryRun: true,
    scope: { subscriptionCode: "synthetic-subscription" },
    policy: { retentionDays: 30, keepLatest: 10 },
    completeness: { inventory: true, protection: true, eligibility: true },
    counts: {
      scanned: 5,
      eligible: 0,
      planned: 0,
      deletionRequested: 0,
      skipped: 5,
      failed: 0,
      unknown: 0,
      deferred: 0,
      protected: 5,
      ...counts,
    },
    ...overrides,
  };
}

const inputCases = [
  ["retention-days", "an integer from 1 to 36500"],
  ["keep-latest", "an integer from 1 to 10000"],
  ["max-deletions", "an integer from 1 to 100"],
  ["timeout-minutes", "an integer from 1 to 60"],
  ["dry-run", "exactly true or false"],
  ["continue-on-delete-error", "exactly true or false"],
  ["token-endpoint", "supported HTTPS OAuth endpoint"],
  ["api-base-url", "without credentials, query or path"],
  ["client-id", "required authentication setting"],
  ["client-secret", "required authentication setting"],
  ["resource", "required authentication setting"],
  ["subscription-code", "valid subscription identifier"],
  ["application-code", "exact application identifier or leave it blank"],
  ["exclude-build-codes", "comma/newline-separated exact build identifiers"],
  ["identifier", "subscription, application or build identifiers are invalid"],
] as const;

const errorCases = [
  ["authorization-failure", "authentication or authorization failed"],
  [
    "inventory-read-failed",
    "inventory or protection information could not be read",
  ],
  ["detail-read-failed", "revalidated immediately before deletion"],
  [
    "invalid-api-response",
    "missing, malformed or contradictory safety information",
  ],
  [
    "incomplete-inventory",
    "inventory was incomplete or changed during discovery",
  ],
  ["request-limit", "discovery request limit was reached"],
  ["deadline", "deadline expired"],
  ["DEADLINE", "deadline expired"],
  ["TIMEOUT", "CCv2 request timed out"],
  ["ABORTED", "cancelled or its request was aborted"],
  ["REQUEST_FAILED", "network request failed"],
  ["HTTP_ERROR", "unsuccessful HTTP response"],
  ["INVALID_TOKEN", "unusable OAuth token response"],
  ["INVALID_URL", "rejected by the shared endpoint policy"],
  ["INVALID_PATH_ENCODING", "identifier could not be encoded safely"],
  ["INVALID_OPTIONS", "rejected invalid request configuration"],
  ["INVALID_RESPONSE", "could not be decoded as required by the API contract"],
  ["RESPONSE_TOO_LARGE", "response-size limit"],
  ["delete-rejected", "rejected a build deletion request"],
  ["mutation-outcome-unknown", "outcome could not be established"],
  ["cleanup-failed", "One or more cleanup operations failed"],
] as const;

describe("cleanup notification outcomes and safe explanations", () => {
  it.each(["dry-run", "no-op", "success"])(
    "keeps a healthy %s successful without changing cleanup counters or decisions",
    (status) => {
      const value = cleanup(
        {
          status,
          dryRun: status === "dry-run",
          decisions: [
            { disposition: "protected", reasons: ["retained-age"] },
            { disposition: "protected", reasons: ["retained-latest"] },
          ],
        },
        status === "success"
          ? {
              eligible: 2,
              planned: 2,
              deletionRequested: 2,
              skipped: 3,
              protected: 3,
            }
          : {},
      );
      const before = structuredClone(value);
      expect(describeCleanupOutcome(value)).toEqual({
        status: "success",
        issues: [],
      });
      expect(value).toEqual(before);
    },
  );

  it("uses warning for a blocked read-only run with verified inventory and clear reasons", () => {
    const value = cleanup({
      status: "blocked",
      completeness: { inventory: true, protection: false, eligibility: false },
      decisions: [
        { disposition: "blocked", reasons: ["eligibility-unverified"] },
        { disposition: "blocked", reasons: ["eligibility-unverified"] },
      ],
    });
    expect(describeCleanupOutcome(value)).toEqual({
      status: "warning",
      issues: [
        {
          code: "eligibility-unverified",
          message: expect.stringContaining("four-hour modification condition"),
        },
        {
          code: "protection-unverified",
          message: expect.stringContaining(
            "operational protection evidence is incomplete",
          ),
        },
      ],
    });
  });

  it("reports reason-only eligibility evidence once and requires verified inventory for warning", () => {
    const value = cleanup({
      status: "blocked",
      decisions: [
        {
          disposition: "blocked",
          reasons: ["eligibility-unverified", "eligibility-unverified"],
        },
      ],
    });
    expect(describeCleanupOutcome(value)).toMatchObject({
      status: "warning",
      issues: [{ code: "eligibility-unverified" }],
    });
    delete value.completeness;
    expect(describeCleanupOutcome(value)).toMatchObject({
      status: "failure",
      error: {
        code: "cleanup-blocked",
        message: expect.stringContaining("four-hour"),
      },
    });
  });

  it("provides a safe generic explanation when no recognized blocked reason is available", () => {
    const value = cleanup({
      status: "blocked",
      scope: { subscriptionCode: "untrusted-context-secret" },
      decisions: [
        { disposition: "blocked", reasons: ["untrusted-api-response-secret"] },
      ],
    });
    const warning = describeCleanupOutcome(value);
    expect(warning).toEqual({
      status: "warning",
      issues: [
        {
          code: "safety-blocked",
          message: expect.stringContaining("Review per-build reasons"),
        },
      ],
    });
    const failure = describeCleanupOutcome({ ...value, dryRun: false });
    expect(failure.status).toBe("failure");
    expect(failure.error).toEqual({
      code: "cleanup-blocked",
      message: warning.issues[0]!.message,
    });
    expect(JSON.stringify([warning, failure])).not.toContain("secret");
  });

  it("bounds and deduplicates issue categories while prioritizing incomplete inventory", () => {
    const value = cleanup({
      status: "blocked",
      completeness: { inventory: false, protection: false, eligibility: false },
      decisions: Array.from({ length: 100 }, () => ({
        disposition: "blocked",
        reasons: [
          "incomplete-inventory",
          "eligibility-unverified",
          "incomplete-inventory",
        ],
      })),
    });
    const explanation = describeCleanupOutcome(value);
    expect(explanation.status).toBe("failure");
    expect(explanation.issues.map((issue) => issue.code)).toEqual([
      "incomplete-inventory",
      "eligibility-unverified",
      "protection-unverified",
    ]);
    expect(explanation.issues).toHaveLength(3);
    expect(explanation.error).toEqual({
      code: "cleanup-blocked",
      message: explanation.issues[0]!.message,
    });
  });

  it("keeps incomplete inventory and impossible dry-run mutation outcomes as failures", () => {
    for (const status of ["dry-run", "no-op", "success", "blocked"]) {
      const incomplete = cleanup({
        status,
        completeness: { inventory: false, protection: true, eligibility: true },
      });
      const contradictory = cleanup({
        status,
        decisions: [
          { disposition: "blocked", reasons: ["incomplete-inventory"] },
        ],
      });
      const mutated = cleanup({ status }, { deletionRequested: 1, skipped: 4 });
      for (const value of [incomplete, contradictory, mutated]) {
        expect(describeCleanupOutcome(value).status).toBe("failure");
        expect(describeCleanupOutcome(value).error).toBeDefined();
      }
    }
  });

  it("never downgrades execution, target, authorization, partial or unknown failures to warning", () => {
    const cases = [
      cleanup({ status: "failed" }),
      cleanup(
        { status: "partial-failure", dryRun: false },
        { deletionRequested: 1, failed: 1, skipped: 3 },
      ),
      cleanup(
        { status: "outcome-unknown", dryRun: false },
        { unknown: 1, skipped: 4 },
      ),
      cleanup({
        status: "blocked",
        error: { code: "authorization-failure", status: 403 },
      }),
      cleanup({ status: "blocked" }, { failed: 1, skipped: 4 }),
      cleanup({ status: "blocked" }, { unknown: 1, skipped: 4 }),
      cleanup({ status: "blocked", dryRun: false }),
      cleanup({ status: "unexpected-status" }),
    ];
    for (const value of cases) {
      const explanation = describeCleanupOutcome(value);
      expect(explanation.status).toBe("failure");
      expect(explanation.error?.message).toBeTruthy();
    }
    expect(describeCleanupOutcome(cases[2]!)).toMatchObject({
      error: {
        code: "mutation-outcome-unknown",
        message: expect.stringContaining("do not blindly retry"),
      },
    });
  });

  it.each(inputCases)(
    "explains invalid %s without including rejected values",
    (input, hint) => {
      const error = {
        code: "invalid-input",
        input,
        message: "rejected-secret-value",
        stack: "raw-secret-stack",
      };
      const explanation = describeCleanupOutcome(
        cleanup({ status: "failed", error }),
      );
      expect(explanation.status).toBe("failure");
      expect(explanation.error?.code).toBe("invalid-input");
      expect(explanation.error?.message).toContain(`Invalid ${input} input.`);
      expect(explanation.error?.message).toContain(hint);
      expect(explanation.error?.message).toContain("No cleanup was started.");
      expect(JSON.stringify(explanation)).not.toContain(
        "rejected-secret-value",
      );
      expect(JSON.stringify(explanation)).not.toContain("raw-secret-stack");
    },
  );

  it("does not reflect unknown or inherited input names", () => {
    for (const input of [
      undefined,
      "unknown-secret-setting",
      "__proto__",
      "constructor",
      "toString",
    ]) {
      const value = cleanup({
        status: "failed",
        error: {
          code: "invalid-input",
          ...(input === undefined ? {} : { input }),
        },
      });
      expect(describeCleanupOutcome(value).error).toEqual({
        code: "invalid-input",
        message: "Cleanup configuration is invalid. No cleanup was started.",
      });
    }
  });

  it.each(errorCases)(
    "explains %s with its safe category and optional HTTP status",
    (code, hint) => {
      const error = {
        code,
        status: 403,
        message: "raw-provider-secret",
        stack: "raw-stack-secret",
      };
      const explanation = describeCleanupOutcome(
        cleanup({ status: "failed", error }),
      );
      expect(explanation.status).toBe("failure");
      expect(explanation.error?.code).toBe(code);
      expect(explanation.error?.message).toContain(hint);
      expect(explanation.error?.message).toMatch(/ HTTP 403\.$/);
      expect(JSON.stringify(explanation)).not.toContain("secret");
    },
  );

  it("uses safe fallback messages for missing, unknown and inherited failure codes", () => {
    const legacy = cleanup();
    delete legacy.completeness;
    expect(describeCleanupOutcome(legacy)).toEqual({
      status: "success",
      issues: [],
    });
    expect(describeCleanupOutcome(cleanup({ status: "failed" })).error).toEqual(
      {
        code: "cleanup-failed",
        message:
          "One or more cleanup operations failed. Review the sanitized report for affected builds.",
      },
    );
    for (const code of [
      "UNRECOGNIZED_FAILURE",
      "__proto__",
      "constructor",
      "toString",
    ]) {
      const explanation = describeCleanupOutcome(
        cleanup({ status: "failed", error: { code } }),
      );
      expect(explanation.error).toEqual({
        code,
        message:
          "Cleanup did not complete successfully. Review the sanitized report.",
      });
    }
  });

  it("keeps an explicit cleanup-blocked error safe even without issue context", () => {
    const explanation = describeCleanupOutcome(
      cleanup({
        status: "failed",
        error: { code: "cleanup-blocked", status: 409 },
      }),
    );
    expect(explanation).toEqual({
      status: "failure",
      issues: [],
      error: {
        code: "cleanup-blocked",
        message:
          "Safety checks blocked cleanup. Review the per-build reasons in the sanitized report. HTTP 409.",
      },
    });
  });
});
