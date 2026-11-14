import {
  createBuildCleanupEvent,
  extractSafeGitHubContext,
  sanitizeBoundedText,
  validateNotificationEvent,
} from "@commercekit-tools/notification-contract";

/** Producer projection only. Validation and the event schema belong to action-kit. */
export interface CleanupNotificationInput {
  runStartedAt: string;
  durationMs: number;
  status: string;
  dryRun: boolean;
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
  };
  error?: { code: string };
}

/** The pinned published contract owns cleanup creation and validation. */
export function createCleanupNotification(
  result: CleanupNotificationInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
  secrets: readonly string[] = [],
): string {
  const safe = (value: string) => sanitizeBoundedText(value, 128, secrets);
  const event: unknown = createBuildCleanupEvent({
    status: ["dry-run", "no-op", "success"].includes(result.status)
      ? "success"
      : "failure",
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
      ...(result.error
        ? {
            error: {
              code: sanitizeBoundedText(result.error.code, 100, secrets),
              message:
                "Cleanup did not complete successfully. Review the sanitized report.",
            },
          }
        : {}),
    },
  });
  return JSON.stringify(validateNotificationEvent(event));
}
