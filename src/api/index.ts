import {
  encodeCcv2PathSegment,
  type Ccv2Client,
  type Ccv2Response,
} from "@commercekit-tools/ccv2-client";
import { identifier, type Inputs } from "../inputs.js";
import type { Build, SafetyEvidence } from "../model.js";
import { timestamp } from "../retention/index.js";

export class CleanupError extends Error {
  constructor(
    readonly code: string,
    readonly status?: number,
  ) {
    super(code);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CleanupError("invalid-api-response");
  return value as Record<string, unknown>;
}
function code(value: unknown): string {
  if (typeof value !== "string") throw new CleanupError("invalid-api-response");
  try {
    return identifier(value);
  } catch {
    throw new CleanupError("invalid-api-response");
  }
}
export function projectBuild(value: unknown, subscriptionCode: string): Build {
  const row = object(value);
  if (
    (row.subscriptionCode !== undefined &&
      row.subscriptionCode !== subscriptionCode) ||
    typeof row.status !== "string" ||
    !row.status ||
    row.status.length > 128
  )
    throw new CleanupError("invalid-api-response");
  const result: { -readonly [K in keyof Build]: Build[K] } = {
    code: code(row.code),
    subscriptionCode,
    status: row.status,
  };
  if (row.applicationCode !== undefined)
    result.applicationCode = code(row.applicationCode);
  for (const key of ["buildStartTimestamp", "buildEndTimestamp"] as const) {
    if (row[key] !== undefined) {
      if (typeof row[key] !== "string" || row[key].length > 64)
        throw new CleanupError("invalid-api-response");
      result[key] = row[key];
    }
  }
  for (const key of ["deployed", "hasSnapshot"] as const) {
    if (row[key] !== undefined) {
      if (typeof row[key] !== "boolean")
        throw new CleanupError("invalid-api-response");
      result[key] = row[key];
    }
  }
  return Object.freeze(result);
}
export interface Discovery {
  builds: readonly Build[];
  evidence: SafetyEvidence;
}
export interface CleanupApi {
  discover(): Promise<Discovery>;
  detail(code: string): Promise<Build | undefined>;
  requestDeletion(code: string): Promise<number>;
}
export const limits = Object.freeze({
  pageSize: 100,
  pages: 100,
  items: 10000,
  requests: 1500,
});
export class SapCleanupApi implements CleanupApi {
  private requests = 0;
  private readonly base: string;
  constructor(
    private readonly input: Inputs,
    private readonly client: Ccv2Client,
    private readonly signal: AbortSignal,
    private readonly deadline: number,
  ) {
    this.base = `v2/subscriptions/${encodeCcv2PathSegment(input.subscriptionCode)}/`;
  }
  private async request(path: string, mutation = false): Promise<Ccv2Response> {
    this.signal.throwIfAborted();
    if (++this.requests > limits.requests)
      throw new CleanupError("request-limit");
    const reply = await this.client.request(this.base + path, {
      policy: mutation ? "unsafe-mutation" : "safe-read",
      method: mutation ? "DELETE" : "GET",
      refreshOn401: !mutation,
      signal: this.signal,
      deadline: this.deadline,
      timeoutMs: 30000,
      maxResponseBytes: 2 * 1024 * 1024,
      headers: { Accept: "application/json" },
    });
    if (reply.status === 401 || reply.status === 403)
      throw new CleanupError("authorization-failure", reply.status);
    return reply;
  }
  private async collection(
    path: string,
    project: (v: unknown) => Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const entries = new Map<string, Record<string, unknown>>();
    let expected: number | undefined;
    for (let page = 0; page < limits.pages; page++) {
      const query = new URLSearchParams({
        $top: String(limits.pageSize),
        $skip: String(page * limits.pageSize),
        $count: "true",
      });
      const reply = await this.request(`${path}?${query}`);
      if (reply.status !== 200)
        throw new CleanupError("inventory-read-failed", reply.status);
      const body = object(
        reply.body.kind === "json" ? reply.body.value : undefined,
      );
      if (
        !Array.isArray(body.value) ||
        body.value.length > limits.pageSize ||
        !Number.isSafeInteger(body.count) ||
        Number(body.count) < 0 ||
        Number(body.count) > limits.items
      )
        throw new CleanupError("invalid-api-response");
      if (expected !== undefined && expected !== body.count)
        throw new CleanupError("incomplete-inventory");
      expected = Number(body.count);
      for (const raw of body.value) {
        const row = project(raw);
        const id = code(row.code);
        // Even identical overlap signals unstable offset pagination; never silently drop it.
        if (entries.has(id))
          throw new CleanupError(
            JSON.stringify(entries.get(id)) === JSON.stringify(row)
              ? "incomplete-inventory"
              : "invalid-api-response",
          );
        entries.set(id, row);
      }
      if (entries.size > expected)
        throw new CleanupError("incomplete-inventory");
      if (body.value.length < limits.pageSize) {
        if (entries.size !== expected)
          throw new CleanupError("incomplete-inventory");
        return [...entries.values()];
      }
    }
    throw new CleanupError("incomplete-inventory");
  }
  /** For operations with no documented pagination parameters. */
  private async boundedCollection(path: string): Promise<unknown[]> {
    const reply = await this.request(path);
    if (reply.status !== 200)
      throw new CleanupError("inventory-read-failed", reply.status);
    const body = object(
      reply.body.kind === "json" ? reply.body.value : undefined,
    );
    if (
      !Array.isArray(body.value) ||
      body.value.length > limits.pageSize ||
      !Number.isSafeInteger(body.count) ||
      Number(body.count) < 0
    )
      throw new CleanupError("invalid-api-response");
    if (body.count !== body.value.length)
      throw new CleanupError("incomplete-inventory");
    return body.value;
  }
  private async inventory(): Promise<readonly Build[]> {
    return (await this.collection("builds", (v) => ({
      ...projectBuild(v, this.input.subscriptionCode),
    }))) as unknown as Build[];
  }
  async discover(): Promise<Discovery> {
    const first = await this.inventory();
    const refs = new Set<string>();
    let protectionComplete = true;
    const deployments = await this.collection("deployments", (v) => {
      const row = object(v);
      if (
        row.subscriptionCode !== this.input.subscriptionCode ||
        typeof row.status !== "string" ||
        row.status.length > 128
      )
        throw new CleanupError("invalid-api-response");
      let cancellationActive = false;
      let cancellationFailed = false;
      if (row.cancelation !== undefined) {
        const cancellation = object(row.cancelation);
        const started =
          typeof cancellation.startTimestamp === "string"
            ? timestamp(cancellation.startTimestamp)
            : undefined;
        const finished =
          typeof cancellation.finishedTimestamp === "string"
            ? timestamp(cancellation.finishedTimestamp)
            : undefined;
        if (
          started === undefined ||
          (cancellation.finishedTimestamp !== undefined &&
            (finished === undefined || finished < started)) ||
          (cancellation.failed !== undefined &&
            typeof cancellation.failed !== "boolean")
        )
          throw new CleanupError("invalid-api-response");
        cancellationActive = finished === undefined;
        cancellationFailed = cancellation.failed === true;
      }
      for (const field of ["isCanaryAvailable", "awaitingDecision"] as const) {
        if (row[field] !== undefined && typeof row[field] !== "boolean")
          throw new CleanupError("invalid-api-response");
      }
      if (
        row.canaryStatus !== undefined &&
        (typeof row.canaryStatus !== "string" || row.canaryStatus.length > 128)
      )
        throw new CleanupError("invalid-api-response");
      return {
        code: code(row.code),
        buildCode: code(row.buildCode),
        status: row.status,
        strategy: row.strategy,
        previousDeploymentCode:
          row.previousDeploymentCode === undefined
            ? undefined
            : code(row.previousDeploymentCode),
        isCanaryAvailable: row.isCanaryAvailable,
        canaryStatus: row.canaryStatus,
        awaitingDecision: row.awaitingDecision,
        cancellationActive,
        cancellationFailed,
      };
    });
    const byDeploymentCode = new Map(
      deployments.map((row) => [String(row.code), row]),
    );
    for (const row of deployments) {
      const live =
        !["UNDEPLOYED", "FAIL"].includes(String(row.status)) ||
        row.cancellationActive === true ||
        row.cancellationFailed === true;
      if (live) refs.add(String(row.buildCode));
      if (
        !["UNDEPLOYED", "FAIL", "SCHEDULED", "DEPLOYING", "DEPLOYED"].includes(
          String(row.status),
        )
      )
        protectionComplete = false;
      if (!live) continue;
      if (
        !["ROLLING_UPDATE", "RECREATE", "GREEN"].includes(String(row.strategy))
      )
        protectionComplete = false;
      if (row.previousDeploymentCode !== undefined) {
        const previous = byDeploymentCode.get(
          String(row.previousDeploymentCode),
        );
        if (previous && previous.code !== row.code)
          refs.add(String(previous.buildCode));
        else protectionComplete = false;
      }
      // Live green/canary and rollback relationships require evidence beyond the list.
      if (
        row.strategy === "GREEN" ||
        row.isCanaryAvailable === true ||
        row.canaryStatus !== undefined ||
        row.awaitingDecision === true ||
        row.cancellationActive === true ||
        row.cancellationFailed === true
      )
        protectionComplete = false;
    }
    const environments = (await this.boundedCollection("environments")).map(
      (v) => {
        const row = object(v);
        if (
          row.subscriptionCode !== this.input.subscriptionCode ||
          typeof row.deploymentStatus !== "string"
        )
          throw new CleanupError("invalid-api-response");
        if (!["UNDEPLOYED", "FAIL", "DEPLOYED"].includes(row.deploymentStatus))
          protectionComplete = false;
        return { code: code(row.code), deploymentStatus: row.deploymentStatus };
      },
    );
    if (
      new Set(environments.map((row) => row.code)).size !== environments.length
    )
      throw new CleanupError("invalid-api-response");
    const backupRefs = new Set<string>();
    for (const environment of environments) {
      // SAP documents no pagination parameters for this operation. Require the
      // returned total to match the collection rather than inventing a cursor.
      const backups = await this.boundedCollection(
        `environments/${encodeCcv2PathSegment(String(environment.code))}/databackups`,
      );
      const seen = new Set<string>();
      for (const value of backups) {
        const row = object(value);
        const id = code(row.databackupCode);
        if (seen.has(id)) throw new CleanupError("invalid-api-response");
        seen.add(id);
        // QUICK backups may explicitly have no build association. Missing data
        // is different from that documented null and must not become "none".
        if (row.buildCode === null && row.databackupType === "QUICK") continue;
        backupRefs.add(code(row.buildCode));
      }
    }
    // A second identical pass detects observable drift, not an atomic snapshot guarantee.
    const second = await this.inventory();
    const canonical = (rows: readonly Build[]) =>
      JSON.stringify([...rows].sort((a, b) => (a.code < b.code ? -1 : 1)));
    if (canonical(first) !== canonical(second))
      throw new CleanupError("incomplete-inventory");
    return {
      builds: second,
      evidence: {
        inventoryComplete: true,
        protectionComplete,
        eligibilityVerified: false,
        activeDeploymentBuildCodes: refs,
        snapshotOrBackupBuildCodes: backupRefs,
      },
    };
  }
  async detail(id: string): Promise<Build | undefined> {
    const reply = await this.request(`builds/${encodeCcv2PathSegment(id)}`);
    if (reply.status === 404) return undefined;
    if (reply.status !== 200)
      throw new CleanupError("detail-read-failed", reply.status);
    const build = projectBuild(
      reply.body.kind === "json" ? reply.body.value : undefined,
      this.input.subscriptionCode,
    );
    if (build.code !== id) throw new CleanupError("invalid-api-response");
    return build;
  }
  async requestDeletion(id: string): Promise<number> {
    return (await this.request(`builds/${encodeCcv2PathSegment(id)}`, true))
      .status;
  }
}
