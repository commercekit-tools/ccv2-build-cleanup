import { describe, expect, it } from "vitest";
import {
  result,
  Sanitizer,
  summary,
  type Result,
} from "../../src/reporting/result.js";
import {
  captureInputValues,
  cleanupInputNames,
  snapshotInputContext,
} from "../../src/reporting/input-context.js";
import { inputs, rawInputs, start } from "../fixtures/builds.js";

function fixture(overrides: Partial<Result> = {}): Result {
  const captured = captureInputValues(
    (name) => rawInputs[name] ?? "",
    () => {},
  );
  return {
    ...result(
      inputs(),
      undefined,
      start,
      start + 1250,
      new Sanitizer(() => {}),
    ),
    ...snapshotInputContext(captured, inputs(), (value) => value),
    status: "dry-run",
    completeness: { inventory: true, protection: true, eligibility: true },
    ...overrides,
  };
}

const safetyBlocked = {
  inventory: true,
  protection: false,
  eligibility: false,
};
const statusCases: Array<{
  label: string;
  patch: Partial<Result>;
  icon: string;
  severity: string;
}> = [
  { label: "dry-run", patch: {}, icon: "✅", severity: "Succeeded" },
  {
    label: "no-op",
    patch: { status: "no-op", dryRun: false },
    icon: "✅",
    severity: "Succeeded",
  },
  {
    label: "successful apply",
    patch: { status: "success", dryRun: false },
    icon: "✅",
    severity: "Succeeded",
  },
  {
    label: "safely blocked dry-run",
    patch: { status: "blocked", completeness: safetyBlocked },
    icon: "⚠️",
    severity: "Completed with warnings",
  },
  {
    label: "blocked apply",
    patch: { status: "blocked", dryRun: false, completeness: safetyBlocked },
    icon: "❌",
    severity: "Failed",
  },
  {
    label: "failed",
    patch: {
      status: "failed",
      error: { code: "authorization-failure", status: 403 },
    },
    icon: "❌",
    severity: "Failed",
  },
  {
    label: "partial failure",
    patch: { status: "partial-failure", dryRun: false },
    icon: "❌",
    severity: "Failed",
  },
  {
    label: "unknown outcome",
    patch: { status: "outcome-unknown", dryRun: false },
    icon: "❌",
    severity: "Failed",
  },
  {
    label: "incomplete inventory",
    patch: {
      status: "blocked",
      completeness: { ...safetyBlocked, inventory: false },
    },
    icon: "❌",
    severity: "Failed",
  },
];

describe("shared cleanup job summary", () => {
  for (const { label, patch, icon, severity } of statusCases)
    it(`shows consistent semantic severity for ${label}`, () => {
      const value = fixture(patch);
      const markdown = summary(value);
      expect(markdown).toContain(icon);
      expect(markdown).toContain(severity);
      expect(markdown).toContain(value.dryRun ? "DRY RUN" : "APPLY");
      expect(markdown).toContain(value.status);
    });

  it("shows every aggregate count, settings, mode and named safety evidence", () => {
    const value = fixture({
      status: "outcome-unknown",
      dryRun: false,
      scope: {
        subscriptionCode: "summary-sub",
        applicationCode: "summary-app",
      },
      counts: {
        scanned: 31,
        eligible: 19,
        planned: 13,
        deletionRequested: 7,
        skipped: 21,
        failed: 1,
        unknown: 2,
        protected: 11,
        deferred: 6,
      },
      decisions: [
        {
          code: "blocked-a",
          disposition: "blocked",
          reasons: ["eligibility-unverified"],
        },
        {
          code: "blocked-b",
          disposition: "blocked",
          reasons: ["incomplete-inventory"],
        },
        {
          code: "blocked-c",
          disposition: "blocked",
          reasons: ["invalid-api-response"],
        },
      ],
    });
    const markdown = summary(value);
    for (const [label, count] of [
      ["Scanned", 31],
      ["Eligible", 19],
      ["Planned", 13],
      ["Deletion requests accepted", 7],
      ["Skipped", 21],
      ["Protected", 11],
      ["Blocked", 3],
      ["Deferred", 6],
      ["Failed", 1],
      ["Unknown", 2],
    ])
      expect(markdown).toContain(`| ${label} | ${count} |`);
    for (const setting of [
      "summary-sub",
      "summary-app",
      "Retention days",
      "Keep latest",
      "Maximum deletion requests",
      "Duration",
      "1250",
    ])
      expect(markdown).toContain(setting);
    for (const label of [
      "Safety evidence",
      "Inventory",
      "Operational protection",
      "Deletion eligibility",
      "Build decisions",
    ])
      expect(markdown).toContain(label);
    expect(markdown).toContain("physical removal is not confirmed");
    expect(markdown).not.toContain("Deleted builds");
  });

  it("explains failure and warning issues without changing cleanup severity", () => {
    const failure = summary(
      fixture({
        status: "failed",
        error: { code: "authorization-failure", status: 403 },
      }),
    );
    expect(failure).toContain("authorization-failure");
    expect(failure).toContain("technical-user permissions");
    expect(failure).toContain("HTTP 403");
    const invalid = summary(
      fixture({
        status: "failed",
        error: { code: "invalid-input", input: "retention-days" },
      }),
    );
    expect(invalid).toContain("Invalid retention-days input");
    expect(invalid).toContain("No cleanup was started");
    const warning = summary(
      fixture({ status: "blocked", completeness: safetyBlocked }),
    );
    expect(warning).toContain("⚠️");
    expect(warning).toContain("eligibility-unverified");
    expect(warning).toContain("four-hour");
    expect(warning).toContain("protection-unverified");
    expect(warning).toContain("Affected builds were protected");
    const incomplete = summary(
      fixture({
        status: "blocked",
        completeness: { ...safetyBlocked, inventory: false },
      }),
    );
    expect(incomplete).toContain("❌");
    expect(incomplete).toContain("inventory is incomplete or unstable");
  });

  it("shows all input names with effective values and validation metadata", () => {
    const value = fixture();
    const markdown = summary(value);
    for (const name of cleanupInputNames) expect(markdown).toContain(name);
    for (const setting of Object.values(value.inputs!))
      expect(markdown.replaceAll("\\", "")).toContain(
        setting === "[REDACTED]" ? "REDACTED" : setting,
      );
    expect(markdown).toContain("Validated");
    expect(markdown).toContain("truncated");
    const missingMetadata = fixture();
    delete missingMetadata.inputsValidated;
    delete missingMetadata.inputsTruncated;
    expect(summary(missingMetadata)).toContain("false");
    const noContext = fixture();
    delete noContext.inputs;
    expect(summary(noContext)).toContain("CCv2 build cleanup");
  });

  it("redacts confidential input names defensively and sanitizes untrusted text", () => {
    const value = fixture();
    value.inputs = { ...value.inputs! };
    const confidential = "synthetic-confidential-summary-value";
    for (const name of [
      "token-endpoint",
      "client-id",
      "client-secret",
      "resource",
    ]) {
      Object.defineProperty(value.inputs, name, {
        value: confidential,
        enumerable: true,
        configurable: true,
      });
    }
    value.scope.subscriptionCode = `sub-${confidential}`;
    const malicious =
      "<script>alert(1)</script> | [click](javascript:alert(1))\n# fake heading";
    value.scope.applicationCode = malicious;
    value.decisions.push({
      code: malicious,
      disposition: "protected",
      reasons: ["explicitly-excluded"],
    });
    const markdown = summary(value, "javascript:alert(1)");
    expect(markdown).not.toContain(confidential);
    expect(markdown).not.toContain("<script>");
    expect(markdown).not.toContain("\n# fake heading");
    expect(markdown).not.toContain("[click](javascript:");
    expect(markdown).not.toContain("[Workflow run](javascript:");
    expect(markdown).toContain("REDACTED");
  });

  it("preserves the decision cap, explicit truncation and bounded summary size", () => {
    const value = fixture({
      inputsTruncated: true,
      decisions: Array.from({ length: 100 }, (_, index) => ({
        code: `bounded-build-${index}`,
        disposition: "protected",
        reasons: ["retained-latest"],
      })),
    });
    const markdown = summary(value);
    expect(markdown).toContain("bounded-build-49");
    expect(markdown).not.toContain("bounded-build-50");
    expect(markdown).toContain("Decision table truncated");
    expect(Buffer.byteLength(markdown)).toBeLessThanOrEqual(65536);
    expect(value.decisions).toHaveLength(100);
  });
});
