import {
  redactKnownSecrets,
  sanitizeBoundedText,
  sanitizeErrorMessage,
  extractSafeGitHubContext,
  renderActionSummary,
  redactJwtLikeTokens,
  type BuildCleanupInputSnapshot,
} from "@commercekit-tools/notification-contract";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateManagementApiBaseUrl } from "@commercekit-tools/ccv2-client";
import type { snapshotInputContext } from "./input-context.js";
import { describeCleanupOutcome } from "./cleanup-issues.js";
import type { Inputs } from "../inputs.js";
import type { Execution, ExecutionDecision } from "../cleanup/execute.js";
export class Sanitizer {
  private readonly secrets = new Set<string>();
  constructor(private readonly mask: (value: string) => void) {}
  add(value: string): void {
    if (value) {
      this.secrets.add(value);
      this.mask(value);
    }
  }
  text(value: string, max = 256): string {
    return sanitizeBoundedText(
      sanitizeErrorMessage(redactKnownSecrets(value, [...this.secrets]), [
        ...this.secrets,
      ]),
      max,
    );
  }
  input(value: string, max = 256): string {
    const text = redactJwtLikeTokens(value);
    try {
      const url = validateManagementApiBaseUrl(text);
      if (url.pathname !== "/") throw new Error("not-origin");
      return sanitizeBoundedText(text, max, [...this.secrets]);
    } catch {
      // Invalid or embedded URLs can contain credentials: use the shared error filter.
      return this.text(text, max);
    }
  }
  env(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
    return Object.fromEntries(
      Object.entries(env).filter(
        ([, value]) =>
          value !== undefined &&
          sanitizeBoundedText(value, 32768, [...this.secrets]) === value,
      ),
    );
  }
  context(env: NodeJS.ProcessEnv): ReturnType<typeof extractSafeGitHubContext> {
    const context = extractSafeGitHubContext(env);
    return Object.fromEntries(
      Object.entries(context).filter(
        ([, value]) =>
          typeof value !== "string" ||
          sanitizeBoundedText(value, 32768, [...this.secrets]) === value,
      ),
    );
  }
}
export interface Result {
  schemaVersion: 1;
  runStartedAt: string;
  durationMs: number;
  status:
    | "dry-run"
    | "no-op"
    | "blocked"
    | "success"
    | "partial-failure"
    | "failed"
    | "outcome-unknown";
  dryRun: boolean;
  inputs?: BuildCleanupInputSnapshot;
  inputsValidated?: boolean;
  inputsTruncated?: boolean;
  scope: { subscriptionCode: string; applicationCode?: string };
  policy: { retentionDays: number; keepLatest: number; maxDeletions: number };
  completeness: {
    inventory: boolean;
    protection: boolean;
    eligibility: boolean;
  };
  counts: {
    scanned: number;
    eligible: number;
    planned: number;
    deletionRequested: number;
    skipped: number;
    failed: number;
    unknown: number;
    protected: number;
    deferred: number;
  };
  decisions: ExecutionDecision[];
  error?: { code: string; status?: number; input?: string };
  truncation: { omittedDecisions: number };
}
export function result(
  input: Inputs | undefined,
  execution: Execution | undefined,
  start: number,
  end: number,
  safe: Sanitizer,
  error?: { code: string; status?: number; input?: string },
  inputContext?: ReturnType<typeof snapshotInputContext>,
): Result {
  const decisions = (execution?.decisions ?? []).map((d) => ({
    ...d,
    code: safe.text(d.code),
    ...(d.applicationCode
      ? { applicationCode: safe.text(d.applicationCode) }
      : {}),
  }));
  const count = (s: ExecutionDecision["disposition"]) =>
    decisions.filter((d) => d.disposition === s).length;
  const counts = {
    scanned: decisions.length,
    eligible: execution?.plan.decisions.filter((d) => d.eligible).length ?? 0,
    planned: execution?.plan.plannedCodes.length ?? 0,
    deletionRequested: count("deletion-requested"),
    skipped: 0,
    failed: count("failed"),
    unknown: count("outcome-unknown"),
    protected: count("protected"),
    deferred: count("deferred"),
  };
  counts.skipped =
    counts.scanned - counts.deletionRequested - counts.failed - counts.unknown;
  const failure = execution?.error ?? error;
  const completeness = {
    inventory: execution?.discovery.evidence.inventoryComplete ?? false,
    protection: execution?.discovery.evidence.protectionComplete ?? false,
    eligibility: execution?.discovery.evidence.eligibilityVerified ?? false,
  };
  const blocked =
    decisions.some((d) => d.disposition === "blocked") ||
    !completeness.inventory ||
    !completeness.protection ||
    !completeness.eligibility;
  const status: Result["status"] = counts.unknown
    ? "outcome-unknown"
    : failure
      ? counts.deletionRequested
        ? "partial-failure"
        : "failed"
      : blocked
        ? "blocked"
        : input?.dryRun
          ? "dry-run"
          : counts.deletionRequested
            ? "success"
            : "no-op";
  return {
    schemaVersion: 1,
    runStartedAt: new Date(start).toISOString(),
    durationMs: Math.max(0, end - start),
    status,
    dryRun: input?.dryRun ?? true,
    ...inputContext,
    scope: {
      subscriptionCode: safe.text(input?.subscriptionCode ?? "unavailable"),
      ...(input?.applicationCode
        ? { applicationCode: safe.text(input.applicationCode) }
        : {}),
    },
    policy: {
      retentionDays: input?.retentionDays ?? 30,
      keepLatest: input?.keepLatest ?? 10,
      maxDeletions: input?.maxDeletions ?? 20,
    },
    completeness,
    counts,
    decisions,
    ...(failure ? { error: failure } : {}),
    truncation: { omittedDecisions: 0 },
  };
}
export function inlineResult(value: Result, max = 65536): string {
  const render = (length: number) =>
    JSON.stringify({
      ...value,
      decisions: value.decisions.slice(0, length),
      truncation: {
        omittedDecisions:
          value.truncation.omittedDecisions + value.decisions.length - length,
      },
    });
  if (Buffer.byteLength(render(0), "utf8") > max)
    throw new Error("report-limit");
  let low = 0;
  let high = value.decisions.length;
  // Bounded logarithmic serializations avoid quadratic work on large reports.
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(render(middle), "utf8") <= max) low = middle;
    else high = middle - 1;
  }
  return render(low);
}

/** Cleanup projection only; shared rendering owns style, escaping and redaction. */
export function summary(value: Result, workflowUrl?: string): string {
  const outcome = describeCleanupOutcome(value);
  const mode = value.dryRun ? "DRY RUN" : "APPLY";
  return renderActionSummary({
    title: `CCv2 build cleanup — ${mode}`,
    status: outcome.status,
    description:
      "Counts represent accepted deletion requests; physical removal is not confirmed. " +
      (value.decisions.length > 50
        ? "Decision table truncated; see report artifact. "
        : "") +
      "Full sanitized detail is at the report-path output; upload it as a workflow artifact for durable access.",
    facts: [
      { label: "Cleanup status", value: value.status },
      { label: "Mode", value: mode },
      { label: "Subscription", value: value.scope.subscriptionCode },
      {
        label: "Application",
        value: value.scope.applicationCode ?? "all applications",
      },
      { label: "Retention days", value: value.policy.retentionDays },
      { label: "Keep latest", value: value.policy.keepLatest },
      { label: "Maximum deletion requests", value: value.policy.maxDeletions },
      { label: "Duration (ms)", value: value.durationMs },
      { label: "Scanned", value: value.counts.scanned },
      { label: "Eligible", value: value.counts.eligible },
      { label: "Planned", value: value.counts.planned },
      {
        label: "Deletion requests accepted",
        value: value.counts.deletionRequested,
      },
      { label: "Skipped", value: value.counts.skipped },
      { label: "Protected", value: value.counts.protected },
      {
        label: "Blocked",
        value: value.decisions.filter(
          (decision) => decision.disposition === "blocked",
        ).length,
      },
      { label: "Deferred", value: value.counts.deferred },
      { label: "Failed", value: value.counts.failed },
      { label: "Unknown", value: value.counts.unknown },
    ],
    ...(value.inputs
      ? {
          inputContext: {
            inputs: { ...value.inputs },
            inputsValidated: value.inputsValidated ?? false,
            inputsTruncated: value.inputsTruncated ?? false,
          },
        }
      : {}),
    ...(outcome.error ? { error: outcome.error } : {}),
    issues: outcome.issues,
    sections: [
      {
        title: "Safety evidence",
        headers: ["Safety check", "Complete"],
        rows: [
          ["Inventory", value.completeness.inventory],
          ["Operational protection", value.completeness.protection],
          ["Deletion eligibility", value.completeness.eligibility],
        ],
      },
      {
        title: "Build decisions",
        headers: ["Build", "Disposition", "Reasons"],
        rows: value.decisions
          .slice(0, 50)
          .map((decision) => [
            decision.code,
            decision.disposition,
            decision.reasons.join(", "),
          ]),
      },
    ],
    ...(workflowUrl
      ? { links: [{ label: "Workflow run", url: workflowUrl }] }
      : {}),
  });
}
export async function writeReport(
  value: Result,
  runnerTemp: string,
): Promise<string> {
  if (!runnerTemp) throw new Error("runner-temp-unavailable");
  await mkdir(runnerTemp, { recursive: true });
  const directory = await mkdtemp(join(runnerTemp, "ccv2-build-cleanup-"));
  const path = join(directory, "report.json");
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  return path;
}
export function outputs(value: Result, reportPath: string, event: string) {
  const c = value.counts;
  return {
    "cleanup-status": value.status,
    "dry-run": String(value.dryRun),
    "scanned-count": c.scanned,
    "eligible-count": c.eligible,
    "planned-count": c.planned,
    "deletion-requested-count": c.deletionRequested,
    "skipped-count": c.skipped,
    "failed-count": c.failed,
    "unknown-count": c.unknown,
    "duration-ms": value.durationMs,
    "result-json": inlineResult(value),
    "notification-event": event,
    "report-path": reportPath,
  };
}
