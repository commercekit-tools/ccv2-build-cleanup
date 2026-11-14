import {
  redactKnownSecrets,
  sanitizeBoundedText,
  sanitizeErrorMessage,
  extractSafeGitHubContext,
  validateGitHubRunUrl,
} from "@commercekit-tools/notification-contract";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  error?: { code: string; status?: number };
  truncation: { omittedDecisions: number };
}
export function result(
  input: Inputs | undefined,
  execution: Execution | undefined,
  start: number,
  end: number,
  safe: Sanitizer,
  error?: { code: string; status?: number },
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

const escape = (text: string) =>
  text
    .replace(/[&<>"'`|[\]*_\\]/g, (c) => `&#${c.charCodeAt(0)};`)
    .replace(/[\r\n]/g, " ");
export function summary(value: Result, workflowUrl?: string): string {
  const { counts: c } = value;
  let safeWorkflowUrl: string | undefined;
  if (workflowUrl) {
    try {
      safeWorkflowUrl = validateGitHubRunUrl(workflowUrl).href.replace(
        /[()]/g,
        (c) => encodeURIComponent(c).replace("(", "%28").replace(")", "%29"),
      );
    } catch {
      /* Invalid references are omitted from the summary. */
    }
  }
  return `## ${value.dryRun ? "DRY RUN" : "APPLY"} — CCv2 build cleanup\n\nStatus: **${escape(value.status)}**\n\nScope: ${escape(value.scope.subscriptionCode)} / ${escape(value.scope.applicationCode ?? "all applications")}\n\nRetention: ${value.policy.retentionDays} days AND outside latest ${value.policy.keepLatest}; cap ${value.policy.maxDeletions}.\n\nInventory / protection / eligibility complete: ${value.completeness.inventory} / ${value.completeness.protection} / ${value.completeness.eligibility}\n\nScanned ${c.scanned}; eligible ${c.eligible}; planned ${c.planned}; deletion requests accepted ${c.deletionRequested}; protected ${c.protected}; deferred ${c.deferred}; failed ${c.failed}; unknown ${c.unknown}.\n\n| Build | Disposition | Reasons |\n| --- | --- | --- |\n${value.decisions
    .slice(0, 50)
    .map(
      (d) =>
        `| ${escape(d.code)} | ${escape(d.disposition)} | ${d.reasons.map(escape).join(", ")} |`,
    )
    .join(
      "\n",
    )}\n\n${value.decisions.length > 50 ? "Decision table truncated; see report artifact.\n" : ""}Full sanitized detail is at the report-path output; upload it as a workflow artifact for durable access.\n${safeWorkflowUrl ? `\n[Workflow run](${safeWorkflowUrl})\n` : ""}`;
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
