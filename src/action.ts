import {
  createCcv2Client,
  TechnicalUserTokenManager,
  type RuntimeDependencies,
} from "@commercekit-tools/ccv2-client";
import { readInputs, type Inputs } from "./inputs.js";
import { SapCleanupApi } from "./api/index.js";
import { execute, safeError, type Execution } from "./cleanup/execute.js";
import {
  Sanitizer,
  result,
  summary,
  writeReport,
  outputs,
} from "./reporting/result.js";
import { createCleanupNotification } from "./reporting/notification.js";
import {
  captureInputValues,
  snapshotInputContext,
  type CapturedInputValues,
} from "./reporting/input-context.js";
export interface ActionCore {
  getInput(name: string): string;
  setSecret(value: string): void;
  setOutput(name: string, value: unknown): void;
  setFailed(message: string): void;
  warning(message: string): void;
  summary: { addRaw(text: string): unknown; write(): Promise<unknown> };
}
export async function run(
  core: ActionCore,
  env: NodeJS.ProcessEnv = process.env,
  signal: AbortSignal = new AbortController().signal,
  runtime: Partial<RuntimeDependencies> = {},
): Promise<void> {
  const now = runtime.now ?? Date.now;
  const start = now();
  const safe = new Sanitizer((value) => core.setSecret(value));
  let input: Inputs | undefined;
  let captured: CapturedInputValues | undefined;
  let execution: Execution | undefined;
  let error: { code: string; status?: number; input?: string } | undefined;
  try {
    captured = captureInputValues(
      (name) => core.getInput(name),
      (value) => safe.add(value),
    );
    input = readInputs(
      (name) => captured?.[name as keyof CapturedInputValues] ?? "",
      (value) => safe.add(value),
    );
    const runSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(input.timeoutMs),
    ]);
    const sharedRuntime = {
      ...runtime,
      maskSecret: (value: string) => safe.add(value),
    };
    const tokens = new TechnicalUserTokenManager(
      {
        tokenEndpoint: input.tokenEndpoint,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        resource: input.resource,
      },
      {
        runtime: sharedRuntime,
      },
    );
    const client = createCcv2Client({
      baseUrl: input.apiBaseUrl,
      tokens,
      runtime: sharedRuntime,
      secrets: [
        input.clientId,
        input.clientSecret,
        input.resource,
        input.tokenEndpoint,
      ],
    });
    const api = new SapCleanupApi(
      input,
      client,
      runSignal,
      start + input.timeoutMs,
    );
    execution = await execute(api, input, start, runSignal, now);
  } catch (cause) {
    error = safeError(cause);
  }
  let inputContext: ReturnType<typeof snapshotInputContext> | undefined;
  try {
    inputContext = snapshotInputContext(captured, input, (text, max) =>
      safe.input(text, max),
    );
  } catch {
    core.warning(
      "Input settings could not be sanitized; cleanup outcome is preserved.",
    );
  }
  const value = result(
    input,
    execution,
    start,
    now(),
    safe,
    error,
    inputContext,
  );
  let event = "";
  let reportPath = "";
  try {
    event = createCleanupNotification(value, safe.env(env));
  } catch {
    core.warning(
      "Notification event generation failed; cleanup outcome is preserved.",
    );
  }
  try {
    reportPath = await writeReport(value, env.RUNNER_TEMP ?? "");
  } catch {
    core.warning(
      "Report file could not be written; inline cleanup results are preserved.",
    );
  }
  for (const [name, output] of Object.entries(
    outputs(value, reportPath, event),
  ))
    core.setOutput(name, output);
  try {
    core.summary.addRaw(summary(value, safe.context(env).runUrl));
    await core.summary.write();
  } catch {
    core.warning(
      "Job summary could not be written; cleanup outputs are preserved.",
    );
  }
  if (
    ["failed", "partial-failure", "outcome-unknown"].includes(value.status) ||
    (!value.dryRun && value.status === "blocked")
  )
    core.setFailed(
      `CCv2 cleanup ${value.status}${value.error ? `: ${value.error.code}` : ""}. See sanitized cleanup report.`,
    );
}
