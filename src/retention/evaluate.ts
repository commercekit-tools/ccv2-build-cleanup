import type {
  Build,
  Decision,
  Policy,
  ReasonCode,
  RetentionPlan,
  SafetyEvidence,
} from "../model.js";

/** RFC3339 instants only; Date.parse alone normalizes impossible calendar dates. */
export function timestamp(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > days[m - 1]! ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  )
    return undefined;
  if (
    zone !== "Z" &&
    (Number(zone!.slice(1, 3)) > 23 || Number(zone!.slice(4)) > 59)
  )
    return undefined;
  return Date.parse(value);
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const marked = (build: Build) =>
  build.markedForDeletion === true ||
  build.status === "DELETED" ||
  build.status === "DELETING";

/** Network-free, deterministic combined retention. All inputs are treated as immutable. */
export function evaluateRetention(
  builds: readonly Build[],
  policy: Policy,
  evidence: SafetyEvidence,
  runStartedAt: number,
): RetentionPlan {
  if (!Number.isFinite(runStartedAt))
    throw new Error("Invalid run start instant.");
  const cutoffMs = runStartedAt - policy.retentionDays * 86400000;
  const scope = builds.filter(
    (build) =>
      policy.applicationCode === undefined ||
      build.applicationCode === policy.applicationCode,
  );
  const nonDeleted = scope.filter((build) => !marked(build));
  const rankable =
    nonDeleted.every(
      (build) => timestamp(build.buildStartTimestamp) !== undefined,
    ) && new Set(scope.map((build) => build.code)).size === scope.length;
  const ranked = nonDeleted
    .filter((build) => timestamp(build.buildStartTimestamp) !== undefined)
    .toSorted(
      (a, b) =>
        timestamp(b.buildStartTimestamp)! - timestamp(a.buildStartTimestamp)! ||
        compare(a.code, b.code),
    );
  const latest = new Set(
    ranked.slice(0, policy.keepLatest).map((build) => build.code),
  );
  const excluded = new Set(policy.excludeBuildCodes);
  const evaluated = scope.map((original) => {
    const build = Object.freeze({ ...original });
    const reasons: ReasonCode[] = [];
    const start = timestamp(build.buildStartTimestamp);
    const end = timestamp(build.buildEndTimestamp);
    const terminal = build.status === "SUCCESS" || build.status === "FAIL";
    const isMarked = marked(build);
    if (latest.has(build.code)) reasons.push("retained-latest");
    if (end !== undefined && end >= cutoffMs) reasons.push("retained-age");
    if (excluded.has(build.code)) reasons.push("explicitly-excluded");
    if (!terminal && !isMarked) reasons.push("active-build");
    if (build.deployed === true) reasons.push("deployed");
    if (evidence.activeDeploymentBuildCodes.has(build.code))
      reasons.push("active-deployment-reference");
    if (
      build.hasSnapshot === true ||
      evidence.snapshotOrBackupBuildCodes.has(build.code)
    )
      reasons.push("snapshot-or-backup-reference");
    if (isMarked) reasons.push("already-marked-for-deletion");
    if (start === undefined || end === undefined)
      reasons.push("missing-timestamp");
    if (start !== undefined && end !== undefined && start > end)
      reasons.push("invalid-api-response");
    if (
      !evidence.eligibilityVerified ||
      !evidence.protectionComplete ||
      build.deployed === undefined ||
      build.hasSnapshot === undefined
    )
      reasons.push("eligibility-unverified");
    if (!evidence.inventoryComplete || !rankable)
      reasons.push("incomplete-inventory");
    const retentionCandidate =
      !isMarked &&
      !latest.has(build.code) &&
      end !== undefined &&
      end < cutoffMs;
    return {
      build,
      reasons: Object.freeze(reasons),
      retentionCandidate,
      eligible: reasons.length === 0,
    };
  });
  const candidates = evaluated
    .filter((decision) => decision.retentionCandidate)
    .toSorted(
      (a, b) =>
        timestamp(a.build.buildEndTimestamp)! -
          timestamp(b.build.buildEndTimestamp)! ||
        compare(a.build.code, b.build.code),
    );
  const eligible = candidates.filter((decision) => decision.eligible);
  const plannedCodes = Object.freeze(
    eligible
      .slice(0, policy.maxDeletions)
      .map((decision) => decision.build.code),
  );
  const selected = new Set(plannedCodes);
  const decisions: readonly Decision[] = Object.freeze(
    evaluated
      .toSorted((a, b) => compare(a.build.code, b.build.code))
      .map((decision) =>
        Object.freeze({
          ...decision,
          selected: selected.has(decision.build.code),
        }),
      ),
  );
  return Object.freeze({
    decisions,
    candidateCodes: Object.freeze(
      candidates.map((decision) => decision.build.code),
    ),
    plannedCodes,
    deferredCodes: Object.freeze(
      eligible
        .slice(policy.maxDeletions)
        .map((decision) => decision.build.code),
    ),
    rankable,
    cutoff: new Date(cutoffMs).toISOString(),
  });
}
