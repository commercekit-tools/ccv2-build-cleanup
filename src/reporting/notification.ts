import {
  createBuildCleanupEvent,
  extractSafeGitHubContext,
  sanitizeBoundedText,
  validateNotificationEvent,
  type BuildCleanupInputSnapshot,
  redactJwtLikeTokens,
} from "@commercekit-tools/notification-contract";
import { describeCleanupOutcome } from "./cleanup-issues.js";
import { snapshotInputContext } from "./input-context.js";

/** Producer projection only. Validation and the event schema belong to action-kit. */
export interface CleanupNotificationInput {
  runStartedAt: string;
  durationMs: number;
  status: string;
  dryRun: boolean;
  inputs?: BuildCleanupInputSnapshot;
  inputsValidated?: boolean;
  inputsTruncated?: boolean;
  completeness?: {
    inventory: boolean;
    protection: boolean;
    eligibility: boolean;
  };
  decisions?: readonly { disposition: string; reasons: readonly string[] }[];
  scope: { subscriptionCode: string; applicationCode?: string };
  policy: { retentionDays: number; keepLatest: number };
  counts: {
    scanned: number;
    eligible: number;
    planned: number;
    deletionRequested: number;
    skipped: number;
    failed: number;
    unknown: number;
    deferred: number;
    protected?: number;
  };
  error?: { code: string; status?: number; input?: string };
}

/** The pinned published contract owns cleanup creation and validation. */
export function createCleanupNotification(
  result: CleanupNotificationInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
  secrets: readonly string[] = [],
): string {
  const safe = (value: string) => sanitizeBoundedText(value, 128, secrets);
  const explanation = describeCleanupOutcome(result);
  const context = result.inputs
    ? snapshotInputContext(result.inputs, undefined, (text, max) =>
        sanitizeBoundedText(redactJwtLikeTokens(text), max, secrets),
      )
    : undefined;
  const event: unknown = createBuildCleanupEvent({
    status: explanation.status,
    occurredAt: result.runStartedAt,
    context: Object.fromEntries(
      Object.entries(extractSafeGitHubContext(env)).map(([key, value]) => [
        key,
        typeof value === "string"
          ? sanitizeBoundedText(value, 2048, secrets)
          : value,
      ]),
    ),
    env: {},
    data: {
      mode: result.dryRun ? "dry-run" : "apply",
      subscriptionCode: safe(result.scope.subscriptionCode),
      ...(result.scope.applicationCode
        ? { applicationCode: safe(result.scope.applicationCode) }
        : {}),
      retentionDays: result.policy.retentionDays,
      keepLatest: result.policy.keepLatest,
      cleanupStatus: sanitizeBoundedText(result.status, 100, secrets),
      scannedCount: result.counts.scanned,
      eligibleCount: result.counts.eligible,
      plannedCount: result.counts.planned,
      deletionRequestedCount: result.counts.deletionRequested,
      skippedCount: result.counts.skipped,
      failedCount: result.counts.failed,
      unknownCount: result.counts.unknown,
      deferredCount: result.counts.deferred,
      durationMs: result.durationMs,
      protectedCount: result.counts.protected ?? 0,
      blockedCount:
        result.decisions?.filter(
          (decision) => decision.disposition === "blocked",
        ).length ?? 0,
      ...(context
        ? {
            inputs: context.inputs,
            inputsValidated: result.inputsValidated ?? false,
            inputsTruncated: Boolean(
              result.inputsTruncated || context?.inputsTruncated,
            ),
          }
        : {}),
      ...(explanation.issues.length
        ? {
            issues: explanation.issues.map((issue) => ({
              code: sanitizeBoundedText(issue.code, 100, secrets),
              message: sanitizeBoundedText(issue.message, 1000, secrets),
            })),
          }
        : {}),
      ...(explanation.error
        ? {
            error: {
              code: sanitizeBoundedText(explanation.error.code, 100, secrets),
              message: sanitizeBoundedText(
                explanation.error.message,
                1000,
                secrets,
              ),
            },
          }
        : {}),
    },
  });
  return JSON.stringify(validateNotificationEvent(event));
}
