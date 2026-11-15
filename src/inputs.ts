import {
  encodeCcv2PathSegment,
  validateManagementApiBaseUrl,
  validateTechnicalUserTokenEndpoint,
  type TechnicalUserCredentials,
} from "@commercekit-tools/ccv2-client";
import type { Policy } from "./model.js";

export interface Inputs extends TechnicalUserCredentials, Policy {
  readonly subscriptionCode: string;
  readonly apiBaseUrl: string;
  readonly dryRun: boolean;
  readonly timeoutMs: number;
  readonly continueOnDeleteError: boolean;
}
export const bounds = Object.freeze({
  retentionDays: 36500,
  keepLatest: 10000,
  maxDeletions: 100,
  timeoutMinutes: 60,
  exclusions: 10000,
});
/** Input names only; values must never become diagnostic text. */
export class InputValidationError extends Error {
  constructor(readonly input: string) {
    super(`Invalid ${input} input.`);
  }
}
const controls = /[\u0000-\u001f\u007f-\u009f]/;
function invalid(name: string): never {
  throw new InputValidationError(name);
}
export function identifier(value: string): string {
  try {
    encodeCcv2PathSegment(value);
  } catch {
    invalid("identifier");
  }
  if (value !== value.trim()) invalid("identifier");
  return value;
}
export function readInputs(
  get: (name: string) => string,
  maskSecret: (value: string) => void = () => {},
): Inputs {
  const credentialNames = [
    "token-endpoint",
    "client-id",
    "client-secret",
    "resource",
  ];
  const credentials = credentialNames.map((name) => get(name));
  for (const value of credentials) if (value) maskSecret(value);
  for (let i = 0; i < credentials.length; i++) {
    const value = credentials[i]!;
    if (!value.trim() || controls.test(value) || value.length > 8192)
      invalid(credentialNames[i]!);
  }
  let tokenEndpoint: string;
  let apiBaseUrl: string;
  try {
    tokenEndpoint = validateTechnicalUserTokenEndpoint(credentials[0]!).href;
  } catch {
    invalid("token-endpoint");
  }
  try {
    apiBaseUrl = validateManagementApiBaseUrl(
      get("api-base-url") || "https://portalapi.commerce.ondemand.com",
    ).href;
  } catch {
    invalid("api-base-url");
  }
  // A configured /v2 prefix would otherwise create an accidental /v2/v2 path.
  if (new URL(apiBaseUrl).pathname !== "/") invalid("api-base-url");
  function integer(name: string, fallback: string, max: number): number {
    const raw = get(name) || fallback;
    const value = Number(raw);
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value) || value > max)
      invalid(name);
    return value;
  }
  function boolean(name: string, fallback: string): boolean {
    const raw = get(name) || fallback;
    if (raw !== "true" && raw !== "false") invalid(name);
    return raw === "true";
  }
  const applicationCode = get("application-code").trim();
  if (applicationCode) identifier(applicationCode);
  const exclusionInput = get("exclude-build-codes");
  if (exclusionInput.length > 129 * bounds.exclusions)
    invalid("exclude-build-codes");
  const excludeBuildCodes = [
    ...new Set(
      exclusionInput
        .split(/[,\r\n]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  if (excludeBuildCodes.length > bounds.exclusions)
    invalid("exclude-build-codes");
  excludeBuildCodes.forEach(identifier);
  return Object.freeze({
    tokenEndpoint,
    clientId: credentials[1]!,
    clientSecret: credentials[2]!,
    resource: credentials[3]!,
    subscriptionCode: identifier(get("subscription-code").trim()),
    apiBaseUrl,
    ...(applicationCode ? { applicationCode } : {}),
    retentionDays: integer("retention-days", "30", bounds.retentionDays),
    keepLatest: integer("keep-latest", "10", bounds.keepLatest),
    maxDeletions: integer("max-deletions", "20", bounds.maxDeletions),
    timeoutMs: integer("timeout-minutes", "15", bounds.timeoutMinutes) * 60000,
    dryRun: boolean("dry-run", "true"),
    continueOnDeleteError: boolean("continue-on-delete-error", "false"),
    excludeBuildCodes: Object.freeze(excludeBuildCodes),
  });
}

/** Mirrored in examples and tested against all scheduler enablement cases. */
export function consumerDryRun(
  enabled: string,
  event: string,
  manualInput?: unknown,
): boolean {
  if (enabled !== "true") return true;
  if (event === "schedule") return false;
  return !(
    event === "workflow_dispatch" &&
    (manualInput === false || manualInput === "false")
  );
}
