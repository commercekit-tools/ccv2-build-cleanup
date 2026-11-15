import { bounds } from "../inputs.js";
import type { CleanupNotificationInput } from "./notification.js";

interface Explanation {
  code: string;
  message: string;
}
const inputHints: Readonly<Record<string, string>> = {
  "retention-days": `Expected an integer from 1 to ${bounds.retentionDays}.`,
  "keep-latest": `Expected an integer from 1 to ${bounds.keepLatest}.`,
  "max-deletions": `Expected an integer from 1 to ${bounds.maxDeletions}.`,
  "timeout-minutes": `Expected an integer from 1 to ${bounds.timeoutMinutes}.`,
  "dry-run": "Expected exactly true or false.",
  "continue-on-delete-error": "Expected exactly true or false.",
  "token-endpoint": "Expected a supported HTTPS OAuth endpoint.",
  "api-base-url":
    "Expected an HTTPS management origin without credentials, query or path.",
  "client-id": "A required authentication setting is missing or invalid.",
  "client-secret": "A required authentication setting is missing or invalid.",
  resource: "A required authentication setting is missing or invalid.",
  "subscription-code": "A valid subscription identifier is required.",
  "application-code":
    "Use a valid exact application identifier or leave it blank.",
  "exclude-build-codes":
    "Use bounded comma/newline-separated exact build identifiers.",
  identifier:
    "One or more subscription, application or build identifiers are invalid.",
};
const failureMessages: Readonly<Record<string, string>> = {
  "authorization-failure":
    "CCv2 authentication or authorization failed. Check the technical-user permissions.",
  "inventory-read-failed":
    "CCv2 inventory or protection information could not be read. No missing data was treated as safe.",
  "detail-read-failed":
    "A build could not be revalidated immediately before deletion. Further deletion requests were stopped.",
  "invalid-api-response":
    "CCv2 returned missing, malformed or contradictory safety information. Cleanup could not continue safely.",
  "incomplete-inventory":
    "The build inventory was incomplete or changed during discovery. Cleanup could not choose targets safely.",
  "request-limit":
    "The bounded discovery request limit was reached before cleanup could complete.",
  deadline:
    "The cleanup deadline expired. Further deletion requests were stopped.",
  DEADLINE:
    "The cleanup deadline expired. Further deletion requests were stopped.",
  TIMEOUT:
    "A CCv2 request timed out. Cleanup did not continue past the failed request.",
  ABORTED:
    "Cleanup was cancelled or its request was aborted. Further deletion requests were stopped.",
  REQUEST_FAILED:
    "A CCv2 network request failed. Cleanup did not continue past the failed request.",
  HTTP_ERROR:
    "A CCv2 authentication or API request returned an unsuccessful HTTP response.",
  INVALID_TOKEN:
    "CCv2 returned an unusable OAuth token response. No token details are included.",
  INVALID_URL:
    "A CCv2 endpoint or request URL was rejected by the shared endpoint policy.",
  INVALID_PATH_ENCODING:
    "A CCv2 request identifier could not be encoded safely.",
  INVALID_OPTIONS:
    "The shared CCv2 client rejected invalid request configuration.",
  INVALID_RESPONSE:
    "A CCv2 response could not be decoded as required by the API contract.",
  RESPONSE_TOO_LARGE:
    "A CCv2 response exceeded the configured response-size limit.",
  "delete-rejected":
    "CCv2 rejected a build deletion request. Review the failed target in the sanitized report.",
  "mutation-outcome-unknown":
    "A deletion request's outcome could not be established. Further requests were stopped; do not blindly retry.",
  "cleanup-failed":
    "One or more cleanup operations failed. Review the sanitized report for affected builds.",
};
function explainFailure(
  value: CleanupNotificationInput,
  issues: readonly Explanation[],
): Explanation {
  const error = value.error ?? {
    code:
      value.status === "blocked"
        ? "cleanup-blocked"
        : value.status === "outcome-unknown"
          ? "mutation-outcome-unknown"
          : "cleanup-failed",
  };
  let message: string;
  if (error.code === "invalid-input") {
    message =
      error.input && Object.hasOwn(inputHints, error.input)
        ? `Invalid ${error.input} input. ${inputHints[error.input]} No cleanup was started.`
        : "Cleanup configuration is invalid. No cleanup was started.";
  } else if (error.code === "cleanup-blocked") {
    message =
      issues[0]?.message ??
      "Safety checks blocked cleanup. Review the per-build reasons in the sanitized report.";
  } else {
    message = Object.hasOwn(failureMessages, error.code)
      ? failureMessages[error.code]!
      : "Cleanup did not complete successfully. Review the sanitized report.";
  }
  if (error.status !== undefined) message += ` HTTP ${error.status}.`;
  return { code: error.code, message };
}

/** Notification severity does not change execution outcome or deletion protections. */
export function describeCleanupOutcome(value: CleanupNotificationInput): {
  status: "success" | "warning" | "failure";
  issues: Explanation[];
  error?: Explanation;
} {
  const reasons = new Set(
    value.decisions?.flatMap((decision) => decision.reasons) ?? [],
  );
  const issues: Explanation[] = [];
  if (
    value.completeness?.inventory === false ||
    reasons.has("incomplete-inventory")
  )
    issues.push({
      code: "incomplete-inventory",
      message:
        "Build inventory is incomplete or unstable; cleanup cannot safely choose deletion targets.",
    });
  if (
    value.completeness?.eligibility === false ||
    reasons.has("eligibility-unverified")
  )
    issues.push({
      code: "eligibility-unverified",
      message:
        "Deletion eligibility could not be verified, including the required four-hour modification condition. Deletion requests are blocked.",
    });
  if (value.completeness?.protection === false)
    issues.push({
      code: "protection-unverified",
      message:
        "Deployment, snapshot, backup or other operational protection evidence is incomplete. Affected builds were protected.",
    });
  if (value.status === "blocked" && issues.length === 0)
    issues.push({
      code: "safety-blocked",
      message:
        "Safety checks blocked one or more cleanup targets. Review per-build reasons in the sanitized report.",
    });
  const failed =
    value.completeness?.inventory === false ||
    reasons.has("incomplete-inventory") ||
    (value.dryRun && value.counts.deletionRequested !== 0) ||
    Boolean(value.error) ||
    ["failed", "partial-failure", "outcome-unknown"].includes(value.status) ||
    value.counts.failed > 0 ||
    value.counts.unknown > 0;
  const warning =
    value.status === "blocked" &&
    value.dryRun &&
    !failed &&
    value.completeness?.inventory === true;
  if (warning) return { status: "warning", issues };
  if (!failed && ["dry-run", "no-op", "success"].includes(value.status))
    return { status: "success", issues };
  return { status: "failure", issues, error: explainFailure(value, issues) };
}
