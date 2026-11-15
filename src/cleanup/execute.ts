import { Ccv2TransportError } from "@commercekit-tools/ccv2-client";
import { CleanupError, type CleanupApi, type Discovery } from "../api/index.js";
import { evaluateRetention } from "../retention/index.js";
import { InputValidationError, type Inputs } from "../inputs.js";
import { cleanupInputNames } from "../reporting/input-context.js";
import type { RetentionPlan, ReasonCode } from "../model.js";
export type Disposition =
  | "protected"
  | "blocked"
  | "deferred"
  | "planned"
  | "deletion-requested"
  | "already-absent"
  | "failed"
  | "outcome-unknown"
  | "unattempted";
export interface ExecutionDecision {
  code: string;
  applicationCode?: string;
  reasons: readonly ReasonCode[];
  disposition: Disposition;
}
export interface Execution {
  plan: RetentionPlan;
  discovery: Discovery;
  decisions: ExecutionDecision[];
  error?: { code: string; status?: number; input?: string };
}
export function safeError(error: unknown): {
  code: string;
  status?: number;
  input?: string;
} {
  if (error instanceof InputValidationError) {
    const known = [...cleanupInputNames, "identifier"].some(
      (name) => name === error.input,
    );
    return { code: "invalid-input", ...(known ? { input: error.input } : {}) };
  }
  if (error instanceof CleanupError || error instanceof Ccv2TransportError)
    return {
      code: error.code,
      ...(error.status === undefined ? {} : { status: error.status }),
    };
  return { code: "execution-failed" };
}
export async function execute(
  api: CleanupApi,
  input: Inputs,
  runStartedAt: number,
  signal: AbortSignal,
  now: () => number = Date.now,
): Promise<Execution> {
  const discovery = await api.discover();
  const plan = evaluateRetention(
    discovery.builds,
    input,
    discovery.evidence,
    runStartedAt,
  );
  const decisions: ExecutionDecision[] = plan.decisions.map((d) => ({
    code: d.build.code,
    ...(d.build.applicationCode
      ? { applicationCode: d.build.applicationCode }
      : {}),
    reasons: d.reasons,
    disposition: d.selected
      ? "planned"
      : d.eligible
        ? "deferred"
        : d.retentionCandidate
          ? "blocked"
          : "protected",
  }));
  const result: Execution = { discovery, plan, decisions };
  if (input.dryRun || !plan.plannedCodes.length) return result;
  for (const id of plan.plannedCodes) {
    const target = decisions.find((d) => d.code === id)!;
    let mutationStarted = false;
    try {
      signal.throwIfAborted();
      if (now() >= runStartedAt + input.timeoutMs)
        throw new CleanupError("deadline");
      // Reconcile the entire retention floor and operational references before every target.
      const current = await api.discover();
      const fresh = await api.detail(id);
      if (!fresh) {
        target.disposition = "already-absent";
        continue;
      }
      const original = discovery.builds.find((b) => b.code === id)!;
      if (
        fresh.applicationCode !== original.applicationCode ||
        fresh.subscriptionCode !== original.subscriptionCode
      )
        throw new CleanupError("invalid-api-response");
      // Detail data wins over list data; no new target can enter the frozen plan.
      const builds = current.builds.map((b) => (b.code === id ? fresh : b));
      const evaluated = evaluateRetention(
        builds,
        input,
        current.evidence,
        runStartedAt,
      ).decisions.find((d) => d.build.code === id);
      if (!evaluated?.eligible) {
        target.disposition = "blocked";
        target.reasons = evaluated?.reasons ?? ["incomplete-inventory"];
        continue;
      }
      signal.throwIfAborted();
      if (now() >= runStartedAt + input.timeoutMs)
        throw new CleanupError("deadline");
      mutationStarted = true;
      const status = await api.requestDeletion(id);
      if (status === 204) target.disposition = "deletion-requested";
      else if (status === 404) target.disposition = "already-absent";
      else if ([400, 409, 422].includes(status)) {
        target.disposition = "failed";
        result.error = { code: "delete-rejected", status };
        if (!input.continueOnDeleteError) break;
      } else if (status === 401 || status === 403)
        throw new CleanupError("authorization-failure", status);
      else throw new CleanupError("mutation-outcome-unknown", status);
    } catch (error) {
      // No authoritative operation identifier exists for reconciliation; absence alone cannot attribute deletion.
      const safe = safeError(error);
      const authorization = safe.code === "authorization-failure";
      target.disposition =
        mutationStarted && !authorization ? "outcome-unknown" : "failed";
      result.error =
        mutationStarted && !authorization
          ? {
              code: "mutation-outcome-unknown",
              ...(safe.status === undefined ? {} : { status: safe.status }),
            }
          : safe;
      break;
    }
  }
  for (const d of decisions)
    if (d.disposition === "planned") d.disposition = "unattempted";
  return result;
}
