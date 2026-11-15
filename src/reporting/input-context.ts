import type { BuildCleanupInputSnapshot } from "@commercekit-tools/notification-contract";
import type { Inputs } from "../inputs.js";

export const cleanupInputNames = Object.freeze([
  "token-endpoint",
  "client-id",
  "client-secret",
  "resource",
  "subscription-code",
  "api-base-url",
  "application-code",
  "retention-days",
  "keep-latest",
  "dry-run",
  "max-deletions",
  "exclude-build-codes",
  "timeout-minutes",
  "continue-on-delete-error",
] as const);

export type CleanupInputName = (typeof cleanupInputNames)[number];
export type CapturedInputValues = Readonly<Record<CleanupInputName, string>>;
type PublicInputName = Exclude<
  CleanupInputName,
  "token-endpoint" | "client-id" | "client-secret" | "resource"
>;

/** Capture once in memory, registering each credential before reading more input. */
export function captureInputValues(
  get: (name: string) => string,
  maskSecret: (value: string) => void,
): CapturedInputValues {
  const credential = (name: CleanupInputName) => {
    const value = get(name);
    if (value) maskSecret(value);
    return value;
  };
  const tokenEndpoint = credential("token-endpoint");
  const clientId = credential("client-id");
  const clientSecret = credential("client-secret");
  const resource = credential("resource");
  return Object.freeze({
    "token-endpoint": tokenEndpoint,
    "client-id": clientId,
    "client-secret": clientSecret,
    resource,
    "subscription-code": get("subscription-code"),
    "api-base-url": get("api-base-url"),
    "application-code": get("application-code"),
    "retention-days": get("retention-days"),
    "keep-latest": get("keep-latest"),
    "dry-run": get("dry-run"),
    "max-deletions": get("max-deletions"),
    "exclude-build-codes": get("exclude-build-codes"),
    "timeout-minutes": get("timeout-minutes"),
    "continue-on-delete-error": get("continue-on-delete-error"),
  });
}

const defaults: Readonly<Record<PublicInputName, string>> = Object.freeze({
  "subscription-code": "(not provided)",
  "api-base-url": "https://portalapi.commerce.ondemand.com",
  "application-code": "(all applications)",
  "retention-days": "30",
  "keep-latest": "10",
  "dry-run": "true",
  "max-deletions": "20",
  "exclude-build-codes": "(none)",
  "timeout-minutes": "15",
  "continue-on-delete-error": "false",
});
const maxInputLength = 256;
const truncatedSuffix = "… [truncated]";

/**
 * Keep the event bounded without ever truncating before shared secret redaction.
 * The caller supplies shared sanitization with all credentials/tokens known at
 * the end of execution. Authentication values are never passed to that callback.
 */
export function snapshotInputContext(
  raw: CapturedInputValues | undefined,
  validated: Inputs | undefined,
  sanitize: (value: string, max: number) => string,
): {
  inputs: BuildCleanupInputSnapshot;
  inputsValidated: boolean;
  inputsTruncated: boolean;
} {
  const values: Readonly<Partial<Record<PublicInputName, string>>> = validated
    ? {
        "subscription-code": validated.subscriptionCode,
        "api-base-url": validated.apiBaseUrl,
        "application-code": validated.applicationCode ?? "",
        "retention-days": String(validated.retentionDays),
        "keep-latest": String(validated.keepLatest),
        "dry-run": String(validated.dryRun),
        "max-deletions": String(validated.maxDeletions),
        "exclude-build-codes": validated.excludeBuildCodes.join(", "),
        "timeout-minutes": String(validated.timeoutMs / 60000),
        "continue-on-delete-error": String(validated.continueOnDeleteError),
      }
    : (raw ?? {});
  let inputsTruncated = false;
  const visible = (name: PublicInputName) => {
    const supplied = values[name];
    const value =
      supplied === undefined || supplied === "" ? defaults[name] : supplied;
    const text = sanitize(value, maxInputLength + 1);
    if (value.trim() === "" || text.trim() === "") return "(blank)";
    if (text.length <= maxInputLength) return text;
    inputsTruncated = true;
    return (
      sanitize(value, maxInputLength - truncatedSuffix.length) + truncatedSuffix
    );
  };
  const inputs: BuildCleanupInputSnapshot = Object.freeze({
    "token-endpoint": "[REDACTED]",
    "client-id": "[REDACTED]",
    "client-secret": "[REDACTED]",
    resource: "[REDACTED]",
    "subscription-code": visible("subscription-code"),
    "api-base-url": visible("api-base-url"),
    "application-code": visible("application-code"),
    "retention-days": visible("retention-days"),
    "keep-latest": visible("keep-latest"),
    "dry-run": visible("dry-run"),
    "max-deletions": visible("max-deletions"),
    "exclude-build-codes": visible("exclude-build-codes"),
    "timeout-minutes": visible("timeout-minutes"),
    "continue-on-delete-error": visible("continue-on-delete-error"),
  });
  return Object.freeze({
    inputs,
    inputsValidated: validated !== undefined,
    inputsTruncated,
  });
}
