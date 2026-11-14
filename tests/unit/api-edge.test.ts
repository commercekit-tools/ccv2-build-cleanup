import { describe, expect, it } from "vitest";
import type { Ccv2Client, Ccv2Response } from "@commercekit-tools/ccv2-client";
import { SapCleanupApi } from "../../src/api/index.js";
import { inputs, build, start } from "../fixtures/builds.js";
function api(handler: (path: string) => unknown) {
  const client: Ccv2Client = {
    request: async (path): Promise<Ccv2Response> => ({
      status: 200,
      body: { kind: "json", value: handler(path) },
      retryAfterMs: 0,
    }),
  };
  return new SapCleanupApi(
    inputs(),
    client,
    new AbortController().signal,
    start + 60000,
  );
}
const row = (extra: Record<string, unknown> = {}) => ({
  code: "deployment",
  subscriptionCode: "sub",
  buildCode: "old",
  status: "DEPLOYED",
  strategy: "ROLLING_UPDATE",
  ...extra,
});
const discover = (rows: unknown[]) =>
  api((path) =>
    path.includes("/deployments?")
      ? { value: rows, count: rows.length }
      : { value: [], count: 0 },
  ).discover();
describe("inventory contract edges", () => {
  it("blocks actual unique count exceeding its advertised count", async () => {
    await expect(
      api(() => ({ value: [build()], count: 0 })).discover(),
    ).rejects.toThrow("incomplete-inventory");
  });
  it("ignores verified completed historical cancellation", async () => {
    const value = await discover([
      row({
        status: "FAIL",
        cancelation: {
          startTimestamp: "2026-01-01T00:00:00Z",
          finishedTimestamp: "2026-01-02T00:00:00Z",
          failed: false,
        },
      }),
    ]);
    expect(value.evidence.protectionComplete).toBe(true);
    expect(value.evidence.activeDeploymentBuildCodes.size).toBe(0);
  });
  it.each([
    {},
    { finishedTimestamp: "2026-01-02T00:00:00Z" },
    { startTimestamp: "invalid" },
    { startTimestamp: "2026-01-01T00:00:00Z", finishedTimestamp: true },
    {
      startTimestamp: "2026-01-02T00:00:00Z",
      finishedTimestamp: "2026-01-01T00:00:00Z",
    },
    { startTimestamp: "2026-01-01T00:00:00Z", failed: "false" },
  ])("rejects malformed/contradictory cancellation %j", async (cancelation) => {
    await expect(discover([row({ cancelation })])).rejects.toThrow(
      "invalid-api-response",
    );
  });
  it.each([undefined, "UNKNOWN", {}, 1])(
    "blocks missing/unknown live strategy %j",
    async (strategy) => {
      expect(
        (await discover([row({ strategy })])).evidence.protectionComplete,
      ).toBe(false);
    },
  );
  it.each(["ROLLING_UPDATE", "RECREATE"])(
    "accepts observed ordinary live strategy %s",
    async (strategy) => {
      expect(
        (await discover([row({ strategy })])).evidence.protectionComplete,
      ).toBe(true);
    },
  );
  it("does not retain every historical relationship", async () => {
    const evidence = (
      await discover([
        row({
          status: "UNDEPLOYED",
          strategy: "UNKNOWN",
          previousDeploymentCode: "missing",
          isCanaryAvailable: true,
        }),
      ])
    ).evidence;
    expect(evidence.protectionComplete).toBe(true);
    expect(evidence.activeDeploymentBuildCodes.size).toBe(0);
  });
  it("protects the known previous deployment build without keeping unrelated historical builds", async () => {
    const evidence = (
      await discover([
        row({ previousDeploymentCode: "previous" }),
        row({
          code: "previous",
          buildCode: "previous-build",
          status: "UNDEPLOYED",
        }),
        row({
          code: "unrelated",
          buildCode: "unrelated-build",
          status: "UNDEPLOYED",
        }),
      ])
    ).evidence;
    expect([...evidence.activeDeploymentBuildCodes]).toEqual([
      "old",
      "previous-build",
    ]);
    expect(evidence.protectionComplete).toBe(true);
  });
  it.each(["missing", "deployment"])(
    "blocks an unresolvable or self-referencing previous deployment %s",
    async (previousDeploymentCode) => {
      expect(
        (await discover([row({ previousDeploymentCode })])).evidence
          .protectionComplete,
      ).toBe(false);
    },
  );
  it.each([
    { strategy: "GREEN" },
    { isCanaryAvailable: true },
    { canaryStatus: "STARTED" },
    { awaitingDecision: true },
    { status: "FAIL", cancelation: { startTimestamp: "2026-01-01T00:00:00Z" } },
    {
      status: "FAIL",
      cancelation: {
        startTimestamp: "2026-01-01T00:00:00Z",
        finishedTimestamp: "2026-01-02T00:00:00Z",
        failed: true,
      },
    },
  ])("blocks unverified live canary/rollback evidence %j", async (extra) => {
    const evidence = (await discover([row(extra)])).evidence;
    expect(evidence.protectionComplete).toBe(false);
    expect(evidence.activeDeploymentBuildCodes.has("old")).toBe(true);
  });
  it.each([
    { isCanaryAvailable: "false" },
    { awaitingDecision: 0 },
    { canaryStatus: false },
    { canaryStatus: "x".repeat(129) },
    { previousDeploymentCode: "../bad" },
  ])("rejects malformed relationship fields %j", async (extra) => {
    await expect(discover([row(extra)])).rejects.toThrow(
      "invalid-api-response",
    );
  });
});
