import { describe, expect, it } from "vitest";
import { evaluateRetention, timestamp } from "../../src/retention/evaluate.js";
import type { Build, Policy, SafetyEvidence } from "../../src/model.js";

const now = Date.parse("2026-06-01T00:00:00Z");
const date = (days: number) => new Date(now - days * 86400000).toISOString();
const build = (code: string, days = 60, patch: Partial<Build> = {}): Build => ({
  code,
  subscriptionCode: "sub",
  applicationCode: "app",
  status: "SUCCESS",
  buildStartTimestamp: date(days + 1),
  buildEndTimestamp: date(days),
  deployed: false,
  hasSnapshot: false,
  ...patch,
});
const policy: Policy = {
  retentionDays: 30,
  keepLatest: 1,
  maxDeletions: 20,
  excludeBuildCodes: [],
};
const safe: SafetyEvidence = {
  inventoryComplete: true,
  protectionComplete: true,
  eligibilityVerified: true,
  activeDeploymentBuildCodes: new Set(),
  snapshotOrBackupBuildCodes: new Set(),
};
const evaluate = (
  builds: readonly Build[],
  patch: Partial<Policy> = {},
  evidence: Partial<SafetyEvidence> = {},
) =>
  evaluateRetention(
    builds,
    { ...policy, ...patch },
    { ...safe, ...evidence },
    now,
  );
const reasons = (item: Build, evidence: Partial<SafetyEvidence> = {}) =>
  evaluate([item, build("latest", 1)], {}, evidence).decisions.find(
    (decision) => decision.build.code === item.code,
  )!.reasons;

describe("combined retention", () => {
  it("requires outside latest-N AND completion older than cutoff", () => {
    const result = evaluate([
      build("old-newest", 60, { buildStartTimestamp: date(62) }),
      build("old-older", 80),
      build("recent-older", 29, { buildStartTimestamp: date(90) }),
    ]);
    expect(result.plannedCodes).toEqual(["old-older"]);
    expect(
      result.decisions.find((d) => d.build.code === "old-newest")!.reasons,
    ).toEqual(["retained-latest"]);
    expect(
      result.decisions.find((d) => d.build.code === "recent-older")!.reasons,
    ).toEqual(["retained-age"]);
    expect(result.cutoff).toBe(date(30));
  });
  it("protects equality at UTC cutoff, including equivalent offsets", () => {
    const result = evaluate([
      build("latest", 1),
      build("equal", 30),
      build("offset", 30, { buildEndTimestamp: "2026-05-02T01:00:00+01:00" }),
      build("older", 30, { buildEndTimestamp: "2026-05-01T23:59:59.999Z" }),
    ]);
    expect(result.plannedCodes).toEqual(["older"]);
    expect(
      result.decisions
        .filter((d) => d.reasons.includes("retained-age"))
        .map((d) => d.build.code),
    ).toEqual(["equal", "latest", "offset"]);
  });
  it("uses start for count, completion for age and oldest-first plan", () => {
    const result = evaluate([
      build("slow", 40, { buildStartTimestamp: date(100) }),
      build("newest-start", 60, { buildStartTimestamp: date(61) }),
      build("fast", 80),
    ]);
    expect(result.plannedCodes).toEqual(["fast", "slow"]);
  });
  it("breaks start and end ties by code without depending on input order", () => {
    const items = [build("z"), build("b"), build("a")];
    expect(evaluate(items).plannedCodes).toEqual(["b", "z"]);
    expect(evaluate(items.toReversed())).toEqual(evaluate(items));
  });
  it("counts deployed/excluded/active/snapshot protected builds in latest-N", () => {
    const items = [
      build("deployed", 1, { deployed: true }),
      build("excluded", 2),
      build("active", 3, { status: "BUILDING" }),
      build("snapshot", 4, { hasSnapshot: true }),
      build("old", 60),
    ];
    const result = evaluate(items, {
      keepLatest: 4,
      excludeBuildCodes: ["excluded"],
    });
    expect(result.plannedCodes).toEqual(["old"]);
    for (const decision of result.decisions.filter(
      (d) => d.build.code !== "old",
    ))
      expect(decision.reasons).toContain("retained-latest");
  });
  it("does not count deletion-marked builds in the floor", () => {
    const result = evaluate([
      build("deleted", 1, { status: "DELETED" }),
      build("deleting", 2, { status: "DELETING" }),
      build("marked", 3, { markedForDeletion: true }),
      build("retained", 60),
      build("eligible", 80),
    ]);
    expect(result.plannedCodes).toEqual(["eligible"]);
    for (const code of ["deleted", "deleting", "marked"])
      expect(
        result.decisions.find((d) => d.build.code === code)!.reasons,
      ).toContain("already-marked-for-deletion");
  });
  it("handles empty inventory and fewer than N builds", () => {
    expect(evaluate([])).toMatchObject({
      decisions: [],
      plannedCodes: [],
      candidateCodes: [],
      rankable: true,
    });
    expect(
      evaluate([build("a"), build("b")], { keepLatest: 10 }).plannedCodes,
    ).toEqual([]);
  });
  it("applies exact application filter and never broadens an empty scope", () => {
    const items = [
      build("a", 60),
      build("b", 80),
      build("c", 1, { applicationCode: "APP" }),
      build("d", 90, { applicationCode: undefined }),
    ];
    expect(evaluate(items, { applicationCode: "app" }).plannedCodes).toEqual([
      "b",
    ]);
    expect(evaluate(items, { applicationCode: "missing" }).decisions).toEqual(
      [],
    );
  });
  it("caps distinct eligible targets and retains deferred order", () => {
    const result = evaluate(
      [build("latest", 1), build("a", 70), build("b", 80), build("c", 90)],
      { maxDeletions: 2 },
    );
    expect(result.candidateCodes).toEqual(["c", "b", "a"]);
    expect(result.plannedCodes).toEqual(["c", "b"]);
    expect(result.deferredCodes).toEqual(["a"]);
    expect(
      result.decisions.filter((d) => d.selected).map((d) => d.build.code),
    ).toEqual(["b", "c"]);
  });
  it("projects and freezes the immutable plan without mutating caller objects", () => {
    const item = build("a");
    const result = evaluate([item]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.decisions)).toBe(true);
    expect(Object.isFrozen(result.decisions[0])).toBe(true);
    expect(Object.isFrozen(result.decisions[0]!.build)).toBe(true);
    expect(Object.isFrozen(result.decisions[0]!.reasons)).toBe(true);
    expect(Object.isFrozen(item)).toBe(false);
  });
});

describe("mandatory operational protection", () => {
  it.each([
    [{ deployed: true }, "deployed"],
    [{ hasSnapshot: true }, "snapshot-or-backup-reference"],
    [{ status: "BUILDING" }, "active-build"],
    [{ status: "SCHEDULED" }, "active-build"],
    [{ status: "UNKNOWN" }, "active-build"],
    [{ status: "FUTURE_STATUS" }, "active-build"],
    [{ deployed: undefined }, "eligibility-unverified"],
    [{ hasSnapshot: undefined }, "eligibility-unverified"],
    [{ buildStartTimestamp: undefined }, "missing-timestamp"],
    [{ buildEndTimestamp: undefined }, "missing-timestamp"],
    [{ buildStartTimestamp: "bad" }, "missing-timestamp"],
    [{ buildEndTimestamp: "bad" }, "missing-timestamp"],
    [{ buildStartTimestamp: date(1) }, "invalid-api-response"],
  ] as const)("protects %j", (patch, reason) => {
    expect(reasons(build("target", 60, patch))).toContain(reason);
  });
  it("allows FAIL terminal status with complete evidence", () => {
    expect(
      evaluate([
        build("latest", 1),
        build("fail", 60, { status: "FAIL", markedForDeletion: false }),
      ]).plannedCodes,
    ).toEqual(["fail"]);
  });
  it("protects active scheduled/blue-green/rollback references and verified backups", () => {
    expect(
      reasons(build("target"), {
        activeDeploymentBuildCodes: new Set(["target"]),
      }),
    ).toContain("active-deployment-reference");
    expect(
      reasons(build("target"), {
        snapshotOrBackupBuildCodes: new Set(["target"]),
      }),
    ).toContain("snapshot-or-backup-reference");
  });
  it.each([
    { inventoryComplete: false },
    { protectionComplete: false },
    { eligibilityVerified: false },
  ])("blocks incomplete/unverified evidence %j", (evidence) => {
    expect(
      evaluate([build("latest", 1), build("target")], {}, evidence)
        .plannedCodes,
    ).toEqual([]);
  });
  it("protects explicitly excluded builds and reports overlapping reasons", () => {
    const result = evaluate(
      [build("target", 1, { deployed: true, hasSnapshot: true })],
      { excludeBuildCodes: ["target"] },
    );
    expect(result.decisions[0]!.reasons).toEqual([
      "retained-latest",
      "retained-age",
      "explicitly-excluded",
      "deployed",
      "snapshot-or-backup-reference",
    ]);
    expect(result.plannedCodes).toEqual([]);
  });
  it("blocks all apply when one non-deleted build cannot be ranked", () => {
    const result = evaluate([
      build("unrankable", 1, { buildStartTimestamp: undefined }),
      build("latest", 2),
      build("target"),
    ]);
    expect(result.rankable).toBe(false);
    expect(result.plannedCodes).toEqual([]);
    expect(
      result.decisions.every((d) => d.reasons.includes("incomplete-inventory")),
    ).toBe(true);
  });
  it("does not let an unrankable deleted build undermine the retention floor", () => {
    expect(
      evaluate([
        build("gone", 1, { status: "DELETED", buildStartTimestamp: undefined }),
        build("latest", 2),
        build("target"),
      ]).plannedCodes,
    ).toEqual(["target"]);
  });
  it("blocks duplicate identities defensively", () => {
    expect(evaluate([build("a"), build("a", 90)]).rankable).toBe(false);
  });
  it("rejects invalid injected clock", () => {
    expect(() => evaluateRetention([], policy, safe, NaN)).toThrow(
      "Invalid run start instant",
    );
  });
});

describe("timestamp parsing", () => {
  it.each([
    undefined,
    "",
    "2026-01-01",
    "2026-02-29T00:00:00Z",
    "2026-00-01T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "2026-01-00T00:00:00Z",
    "2026-01-32T00:00:00Z",
    "2026-04-31T00:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T00:60:00Z",
    "2026-01-01T00:00:60Z",
    "2026-01-01T00:00:00+24:00",
    "2026-01-01T00:00:00+00:60",
  ])("rejects %j", (input) => expect(timestamp(input)).toBeUndefined());
  it.each([
    "2024-02-29T00:00:00Z",
    "2000-02-29T00:00:00Z",
    "1900-02-28T00:00:00Z",
    "2026-01-01T00:00:00.123456789Z",
    "2026-01-01T01:00:00+01:00",
    "2025-12-31T23:00:00-01:00",
  ])("accepts valid instant %s", (input) =>
    expect(timestamp(input)).toBe(Date.parse(input)),
  );
  it("rejects a non-leap century", () =>
    expect(timestamp("1900-02-29T00:00:00Z")).toBeUndefined());
});

describe("monotonic retention properties", () => {
  it("increasing keep-latest, retention-days, or exclusions never increases deletion set", () => {
    for (let seed = 1; seed <= 120; seed++) {
      const items = Array.from({ length: 25 }, (_, index) =>
        build(`b${index}`, 1 + ((index * seed * 17) % 300), {
          status: index % 6 === 0 ? "FAIL" : "SUCCESS",
          deployed: index % 11 === 0,
          hasSnapshot: index % 13 === 0,
        }),
      );
      const baselinePolicy = {
        keepLatest: 1 + (seed % 10),
        retentionDays: 1 + (seed % 100),
        maxDeletions: 100,
      };
      const base = new Set(evaluate(items, baselinePolicy).plannedCodes);
      for (const change of [
        { keepLatest: baselinePolicy.keepLatest + 1 },
        { retentionDays: baselinePolicy.retentionDays + 1 },
        { excludeBuildCodes: ["b3", "b7", "b10"] },
      ]) {
        const stricter = evaluate(items, {
          ...baselinePolicy,
          ...change,
        }).plannedCodes;
        expect(stricter.every((code) => base.has(code))).toBe(true);
      }
    }
  });
});
