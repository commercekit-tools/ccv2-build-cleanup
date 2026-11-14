import * as contract from "@commercekit-tools/notification-contract";

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

/** Published 0.0.3 cannot represent cleanup. Never substitute an unrelated event. */
export function createCleanupNotification(
  result: CleanupNotificationInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
  secrets: readonly string[] = [],
): string | undefined {
  if (
    !("createBuildCleanupEvent" in contract) ||
    typeof contract.createBuildCleanupEvent !== "function"
  )
    return undefined;
  const safe = (value: string) =>
    contract.sanitizeBoundedText(value, 128, secrets);
  const event: unknown = contract.createBuildCleanupEvent({
    status: ["dry-run", "no-op", "success"].includes(result.status)
      ? "success"
      : "failure",
    occurredAt: result.runStartedAt,
    context: Object.fromEntries(
      Object.entries(contract.extractSafeGitHubContext(env)).map(
        ([key, value]) => [
          key,
          typeof value === "string"
            ? contract.sanitizeBoundedText(value, 2048, secrets)
            : value,
        ],
      ),
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
      cleanupStatus: contract.sanitizeBoundedText(result.status, 100, secrets),
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
              code: contract.sanitizeBoundedText(
                result.error.code,
                100,
                secrets,
              ),
              message:
                "Cleanup did not complete successfully. Review the sanitized report.",
            },
          }
        : {}),
    },
  });
  return JSON.stringify(contract.validateNotificationEvent(event));
}
