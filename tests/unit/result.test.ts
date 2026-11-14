import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, stat, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  Sanitizer,
  result,
  inlineResult,
  summary,
  outputs,
  writeReport,
} from "../../src/reporting/result.js";
import type { Execution, Disposition } from "../../src/cleanup/execute.js";
import type { Inputs } from "../../src/inputs.js";
const input: Inputs = {
  tokenEndpoint: "https://auth.example.com/oauth/token",
  clientId: "test",
  clientSecret: "secret",
  resource: "resource",
  subscriptionCode: "test-sub",
  apiBaseUrl: "https://api.example.com/",
  dryRun: true,
  timeoutMs: 60000,
  continueOnDeleteError: false,
  retentionDays: 30,
  keepLatest: 10,
  maxDeletions: 2,
  excludeBuildCodes: [],
};
const start = Date.parse("2026-11-13T00:00:00Z");
const safe = () => new Sanitizer(() => {});
function execution(
  dispositions: Disposition[] = [],
  error?: { code: string; status?: number },
): Execution {
  const decisions = dispositions.map((disposition, index) => ({
    code: `build-${index}`,
    applicationCode: "app",
    reasons: ["retained-latest", "deployed"] as const,
    disposition,
  }));
  return {
    decisions,
    discovery: {
      builds: [],
      evidence: {
        inventoryComplete: true,
        protectionComplete: true,
        eligibilityVerified: true,
        activeDeploymentBuildCodes: new Set(),
        snapshotOrBackupBuildCodes: new Set(),
      },
    },
    plan: {
      decisions: decisions.map((d) => ({
        build: {
          code: d.code,
          subscriptionCode: "test-sub",
          status: "SUCCESS",
        },
        reasons: d.reasons,
        retentionCandidate: d.disposition !== "protected",
        eligible: d.disposition !== "protected",
        selected: d.disposition === "planned",
      })),
      candidateCodes: [],
      plannedCodes: ["build-1", "build-2"],
      deferredCodes: [],
      rankable: true,
      cutoff: "2026-10-14T00:00:00Z",
    },
    ...(error ? { error } : {}),
  };
}
describe("sanitized reports", () => {
  it("registers secrets, bounds and redacts safe text without exposing raw errors", () => {
    const mask = vi.fn();
    const sanitizer = new Sanitizer(mask);
    sanitizer.add("");
    sanitizer.add("known-secret");
    expect(mask).toHaveBeenCalledExactlyOnceWith("known-secret");
    expect(
      sanitizer.text(
        "known-secret https://private.example/x at stack (secret)",
        50,
      ),
    ).toBe("[REDACTED] [URL]");
    expect(sanitizer.text("x".repeat(400))).toHaveLength(256);
    expect(
      sanitizer.env({
        GITHUB_ACTOR: "known-secret",
        GITHUB_JOB: undefined,
        SAFE: "yes",
      }),
    ).toEqual({ SAFE: "yes" });
  });
  it("extracts safe GitHub context and preserves valid enterprise workflow links", () => {
    const sanitizer = safe();
    sanitizer.add("known-secret");
    expect(
      sanitizer.context({
        GITHUB_REPOSITORY: "org/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_SERVER_URL: "https://github.enterprise.example",
        GITHUB_ACTOR: "known-secret",
        GITHUB_RUN_ATTEMPT: "2",
      }),
    ).toEqual({
      repository: "org/repo",
      runId: "42",
      runAttempt: 2,
      runUrl: "https://github.enterprise.example/org/repo/actions/runs/42",
    });
    expect(
      sanitizer.env({ GITHUB_SERVER_URL: "https://github.enterprise.example" }),
    ).toEqual({ GITHUB_SERVER_URL: "https://github.enterprise.example" });
  });
  it("preserves disjoint disposition totals and overlapping reason counts", () => {
    const dispositions: Disposition[] = [
      "protected",
      "blocked",
      "deferred",
      "planned",
      "deletion-requested",
      "already-absent",
      "failed",
      "outcome-unknown",
      "unattempted",
    ];
    const value = result(
      input,
      execution(dispositions, { code: "mutation-outcome-unknown" }),
      start,
      start + 100,
      safe(),
    );
    expect(value.counts).toEqual({
      scanned: 9,
      eligible: 8,
      planned: 2,
      deletionRequested: 1,
      skipped: 6,
      failed: 1,
      unknown: 1,
      protected: 1,
      deferred: 1,
    });
    expect(value.counts.scanned).toBe(
      value.counts.skipped +
        value.counts.deletionRequested +
        value.counts.failed +
        value.counts.unknown,
    );
    expect(value.status).toBe("outcome-unknown");
    expect(value.decisions[0]?.reasons).toEqual([
      "retained-latest",
      "deployed",
    ]);
    expect(value.durationMs).toBe(100);
  });
  for (const [dryRun, dispositions, error, expected] of [
    [true, [], undefined, "dry-run"],
    [false, [], undefined, "no-op"],
    [false, ["deletion-requested"], undefined, "success"],
    [false, ["blocked"], undefined, "blocked"],
    [false, ["failed"], { code: "delete-rejected", status: 409 }, "failed"],
    [
      false,
      ["deletion-requested", "failed"],
      { code: "delete-rejected" },
      "partial-failure",
    ],
  ] as const)
    it(`reports outcome ${expected}`, () => {
      expect(
        result(
          { ...input, dryRun },
          execution([...dispositions], error),
          start,
          start,
          safe(),
        ).status,
      ).toBe(expected);
    });
  it("preserves early failure, conservative defaults and sanitized scope/build codes", () => {
    const sanitizer = safe();
    sanitizer.add("secret");
    const failed = result(undefined, undefined, start, start - 1, sanitizer, {
      code: "invalid-input",
    });
    expect(failed).toMatchObject({
      dryRun: true,
      durationMs: 0,
      status: "failed",
      scope: { subscriptionCode: "unavailable" },
      completeness: { inventory: false, protection: false, eligibility: false },
      error: { code: "invalid-input" },
    });
    const e = execution(["protected"]);
    e.decisions[0]!.code = "secret-build";
    delete e.decisions[0]!.applicationCode;
    const value = result(
      {
        ...input,
        subscriptionCode: "secret-sub",
        applicationCode: "secret-app",
      },
      e,
      start,
      start,
      sanitizer,
    );
    expect(JSON.stringify(value)).not.toContain("secret");
    expect(result(input, undefined, start, start, safe()).status).toBe(
      "blocked",
    );
  });
  it("blocks each incomplete protection/eligibility state", () => {
    for (const key of [
      "inventoryComplete",
      "protectionComplete",
      "eligibilityVerified",
    ] as const) {
      const e = execution();
      e.discovery.evidence = { ...e.discovery.evidence, [key]: false };
      expect(result(input, e, start, start, safe()).status).toBe("blocked");
    }
  });
  it("bounds inline detail by bytes, records omission and leaves full report intact", () => {
    const value = result(
      input,
      execution(Array(300).fill("protected")),
      start,
      start,
      safe(),
    );
    value.decisions.forEach((d) => {
      d.code = "é".repeat(100);
    });
    const text = inlineResult(value, 4096);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(4096);
    expect(JSON.parse(text).truncation.omittedDecisions).toBeGreaterThan(0);
    expect(value.decisions).toHaveLength(300);
    expect(value.truncation.omittedDecisions).toBe(0);
    expect(() => inlineResult(value, 1)).toThrow("report-limit");
    expect(JSON.parse(inlineResult(value)).decisions.length).toBeGreaterThan(0);
  });
  it("escapes malicious summary cells, bounds rows and rejects unsafe workflow URLs", () => {
    const value = result(
      { ...input, applicationCode: "<img> | *x*" },
      execution(Array(51).fill("protected")),
      start,
      start,
      safe(),
    );
    value.decisions[0]!.code = "<script> & | [x](evil) `code`\nnew";
    const md = summary(value, "javascript:alert(1)");
    expect(md).toContain("DRY RUN");
    expect(md).toContain("Decision table truncated");
    expect(md).not.toContain("<script>");
    expect(md).not.toContain("javascript:");
    expect(md).toContain("&#60;script&#62;");
    expect(
      summary(
        { ...value, dryRun: false },
        "https://github.com/org/repo/actions/runs/42",
      ),
    ).toContain("[Workflow run](https://github.com/org/repo/actions/runs/42)");
    expect(summary(value, "https://example.com/a)b")).toContain("a%29b");
    expect(summary(result(input, execution(), start, start, safe()))).toContain(
      "all applications",
    );
  });
  it("escapes every parenthesis in validated workflow links without double-encoding URLs", () => {
    const value = result(input, execution(), start, start, safe());
    const url =
      "https://github.enterprise.example/org/repo/actions/runs/42?target=(one)(two)&nested=((three))&encoded=%28four%29";
    const expected =
      "https://github.enterprise.example/org/repo/actions/runs/42?target=%28one%29%28two%29&nested=%28%28three%29%29&encoded=%28four%29";
    const markdown = summary(value, url);
    expect(markdown).toContain(`[Workflow run](${expected})`);
    expect(markdown).not.toContain(url);
    expect(markdown.match(/\[Workflow run\]\(([^()\n]+)\)/)?.[1]).toBe(
      expected,
    );
  });
  it("writes controlled private full reports and handles filesystem failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cleanup-report-test-"));
    try {
      const value = result(
        input,
        execution(["protected"]),
        start,
        start,
        safe(),
      );
      const path = await writeReport(value, directory);
      expect(path.startsWith(directory + "/ccv2-build-cleanup-")).toBe(true);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(value);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      await expect(writeReport(value, "")).rejects.toThrow(
        "runner-temp-unavailable",
      );
      const file = join(directory, "existing-file");
      await writeFile(file, "x");
      await expect(writeReport(value, file)).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("writes accurate documented output names and valid bounded JSON", () => {
    const value = result(
      input,
      execution(["deletion-requested"]),
      start,
      start + 3,
      safe(),
    );
    const output = outputs(value, "/runner-temp/report.json", "valid-event");
    expect(output).toMatchObject({
      "cleanup-status": "dry-run",
      "dry-run": "true",
      "scanned-count": 1,
      "deletion-requested-count": 1,
      "notification-event": "valid-event",
      "report-path": "/runner-temp/report.json",
      "duration-ms": 3,
    });
    expect(output).not.toHaveProperty("deleted-count");
    expect(JSON.parse(output["result-json"])).toEqual(value);
  });
});
