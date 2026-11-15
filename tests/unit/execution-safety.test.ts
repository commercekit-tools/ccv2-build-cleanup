import { describe, expect, it, vi } from "vitest";
import { Ccv2TransportError } from "@commercekit-tools/ccv2-client";
import {
  CleanupError,
  type CleanupApi,
  type Discovery,
} from "../../src/api/index.js";
import { execute, safeError } from "../../src/cleanup/execute.js";
import { InputValidationError, readInputs } from "../../src/inputs.js";
import type { Build } from "../../src/model.js";
const now = Date.parse("2026-06-01T00:00:00Z");
const date = (days: number) => new Date(now - days * 86400000).toISOString();
const build = (code: string, days: number): Build => ({
  code,
  subscriptionCode: "sub",
  applicationCode: "app",
  status: "SUCCESS",
  buildStartTimestamp: date(days + 1),
  buildEndTimestamp: date(days),
  deployed: false,
  hasSnapshot: false,
});
const builds = [
  build("latest", 1),
  build("a", 60),
  build("b", 90),
  build("c", 120),
];
const discovery = (items = builds): Discovery => ({
  builds: items,
  evidence: {
    inventoryComplete: true,
    protectionComplete: true,
    eligibilityVerified: true,
    activeDeploymentBuildCodes: new Set(),
    snapshotOrBackupBuildCodes: new Set(),
  },
});
function harness(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    "token-endpoint": "https://auth.test/token",
    "client-id": "client",
    "client-secret": "secret",
    resource: "resource",
    "subscription-code": "sub",
    "keep-latest": "1",
    "max-deletions": "2",
    "dry-run": "false",
    ...overrides,
  };
  const input = readInputs((name) => values[name] ?? "");
  const controller = new AbortController();
  const api = {
    discover: vi.fn<CleanupApi["discover"]>().mockResolvedValue(discovery()),
    detail: vi
      .fn<CleanupApi["detail"]>()
      .mockImplementation(async (code) =>
        builds.find((build) => build.code === code),
      ),
    requestDeletion: vi
      .fn<CleanupApi["requestDeletion"]>()
      .mockResolvedValue(204),
  };
  return {
    api,
    input,
    controller,
    run: () => execute(api, input, now, controller.signal, () => now),
  };
}
describe("safe sequential execution", () => {
  it("performs no mutations for dry-run using the same bounded plan", async () => {
    const h = harness({ "dry-run": "true" });
    const result = await h.run();
    expect(result.plan.plannedCodes).toEqual(["c", "b"]);
    expect(
      result.decisions
        .filter((d) => d.disposition === "planned")
        .map((d) => d.code),
    ).toEqual(["b", "c"]);
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
    expect(h.api.detail).not.toHaveBeenCalled();
    expect(h.api.discover).toHaveBeenCalledTimes(1);
  });
  it("returns an empty plan without mutations", async () => {
    const h = harness();
    h.api.discover.mockResolvedValue(discovery([]));
    expect((await h.run()).decisions).toEqual([]);
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("accepts 204 as request initiation and never waits for disappearance", async () => {
    const h = harness();
    const result = await h.run();
    expect(h.api.requestDeletion.mock.calls.map(([code]) => code)).toEqual([
      "c",
      "b",
    ]);
    expect(
      result.decisions
        .filter((d) => d.disposition === "deletion-requested")
        .map((d) => d.code),
    ).toEqual(["b", "c"]);
    expect(result.decisions.find((d) => d.code === "a")!.disposition).toBe(
      "deferred",
    );
    expect(h.api.discover).toHaveBeenCalledTimes(3);
    expect(h.api.detail).toHaveBeenCalledTimes(2);
    expect(result.discovery.builds).toHaveLength(4);
  });
  it("records preflight absence without attributing deletion, never refilling cap", async () => {
    const h = harness();
    h.api.detail.mockResolvedValueOnce(undefined);
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
      "already-absent",
    );
    expect(h.api.requestDeletion.mock.calls.map(([code]) => code)).toEqual([
      "b",
    ]);
    expect(result.decisions.find((d) => d.code === "a")!.disposition).toBe(
      "deferred",
    );
  });
  it("records conservative DELETE 404 classification", async () => {
    const h = harness();
    h.api.requestDeletion.mockResolvedValueOnce(404);
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
      "already-absent",
    );
    expect(
      result.decisions.filter((d) => d.disposition === "deletion-requested"),
    ).toHaveLength(1);
  });
  it.each(["applicationCode", "subscriptionCode"] as const)(
    "stops on revalidation identity/scope mismatch %s",
    async (field) => {
      const h = harness();
      h.api.detail.mockResolvedValueOnce({
        ...builds[3]!,
        [field]: "different",
      });
      const result = await h.run();
      expect(result.error?.code).toBe("invalid-api-response");
      expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
        "failed",
      );
      expect(result.decisions.find((d) => d.code === "b")!.disposition).toBe(
        "unattempted",
      );
      expect(h.api.requestDeletion).not.toHaveBeenCalled();
    },
  );
  it.each([
    [{ deployed: true }, "deployed"],
    [{ hasSnapshot: true }, "snapshot-or-backup-reference"],
    [{ status: "BUILDING" }, "active-build"],
    [{ buildEndTimestamp: date(1) }, "retained-age"],
  ] as const)(
    "shrinks frozen plan on new detail protection %j",
    async (patch, reason) => {
      const h = harness();
      h.api.detail.mockResolvedValueOnce({ ...builds[3]!, ...patch });
      const result = await h.run();
      expect(result.decisions.find((d) => d.code === "c")).toMatchObject({
        disposition: "blocked",
        reasons: expect.arrayContaining([reason]),
      });
      expect(h.api.requestDeletion.mock.calls.map(([code]) => code)).toEqual([
        "b",
      ]);
    },
  );
  it("reconciles a changed latest-N floor before deletion", async () => {
    const h = harness();
    h.api.discover
      .mockResolvedValueOnce(discovery())
      .mockResolvedValueOnce(discovery([builds[3]!]))
      .mockResolvedValueOnce(discovery());
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")!.reasons).toContain(
      "retained-latest",
    );
    expect(h.api.requestDeletion.mock.calls.map(([code]) => code)).toEqual([
      "b",
    ]);
  });
  it("blocks when target is absent from reconciled inventory", async () => {
    const h = harness();
    h.api.discover
      .mockResolvedValueOnce(discovery())
      .mockResolvedValue(discovery(builds.slice(0, 3)));
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")).toMatchObject({
      disposition: "blocked",
      reasons: ["incomplete-inventory"],
    });
  });
  it("refreshes operational reference information per target", async () => {
    const h = harness();
    const changed = discovery();
    changed.evidence = {
      ...changed.evidence,
      activeDeploymentBuildCodes: new Set(["c"]),
      snapshotOrBackupBuildCodes: new Set(["b"]),
    };
    h.api.discover
      .mockResolvedValueOnce(discovery())
      .mockResolvedValue(changed);
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")!.reasons).toContain(
      "active-deployment-reference",
    );
    expect(result.decisions.find((d) => d.code === "b")!.reasons).toContain(
      "snapshot-or-backup-reference",
    );
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("preserves blocked initial candidates and never newly enables them mid-run", async () => {
    const h = harness();
    const initial = discovery(
      builds.map((b) => (b.code === "c" ? { ...b, deployed: true } : b)),
    );
    h.api.discover
      .mockResolvedValueOnce(initial)
      .mockResolvedValue(discovery());
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
      "blocked",
    );
    expect(h.api.requestDeletion.mock.calls.map(([code]) => code)).toEqual([
      "b",
      "a",
    ]);
  });
  it.each([400, 409, 422])(
    "stops after definitive local rejection %s by default",
    async (status) => {
      const h = harness();
      h.api.requestDeletion.mockResolvedValueOnce(status);
      const result = await h.run();
      expect(result.error).toEqual({ code: "delete-rejected", status });
      expect(h.api.requestDeletion).toHaveBeenCalledTimes(1);
      expect(result.decisions.find((d) => d.code === "b")!.disposition).toBe(
        "unattempted",
      );
    },
  );
  it("continuation preserves non-success and counts distinct targets, not successes", async () => {
    const h = harness({ "continue-on-delete-error": "true" });
    h.api.requestDeletion.mockResolvedValueOnce(409);
    const result = await h.run();
    expect(result.error).toEqual({ code: "delete-rejected", status: 409 });
    expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
      "failed",
    );
    expect(result.decisions.find((d) => d.code === "b")!.disposition).toBe(
      "deletion-requested",
    );
    expect(h.api.requestDeletion.mock.calls.map(([code]) => code)).toEqual([
      "c",
      "b",
    ]);
  });
  it.each([401, 403])(
    "stops authorization failure %s despite continuation",
    async (status) => {
      const h = harness({ "continue-on-delete-error": "true" });
      h.api.requestDeletion.mockResolvedValueOnce(status);
      const result = await h.run();
      expect(result.error).toEqual({ code: "authorization-failure", status });
      expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
        "failed",
      );
      expect(h.api.requestDeletion).toHaveBeenCalledTimes(1);
    },
  );
  it.each([500, 502, 429, 201])(
    "treats mutation status %s as ambiguous and never replays",
    async (status) => {
      const h = harness({ "continue-on-delete-error": "true" });
      h.api.requestDeletion.mockResolvedValueOnce(status);
      const result = await h.run();
      expect(result.error).toEqual({
        code: "mutation-outcome-unknown",
        status,
      });
      expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
        "outcome-unknown",
      );
      expect(h.api.requestDeletion).toHaveBeenCalledTimes(1);
    },
  );
  it("stops ambiguous network/timeout loss without blind replay or attributing absence", async () => {
    const h = harness({ "continue-on-delete-error": "true" });
    h.api.requestDeletion.mockRejectedValueOnce(
      new Error("sensitive raw transport body"),
    );
    const result = await h.run();
    expect(result.error).toEqual({ code: "mutation-outcome-unknown" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(h.api.discover).toHaveBeenCalledTimes(2);
    expect(h.api.requestDeletion).toHaveBeenCalledTimes(1);
  });
  it("preserves earlier accepted requests on later failure", async () => {
    const h = harness();
    h.api.requestDeletion.mockResolvedValueOnce(204).mockResolvedValueOnce(409);
    const result = await h.run();
    expect(result.decisions.find((d) => d.code === "c")!.disposition).toBe(
      "deletion-requested",
    );
    expect(result.decisions.find((d) => d.code === "b")!.disposition).toBe(
      "failed",
    );
  });
  it("never treats a failed protection read as an empty protection set", async () => {
    const h = harness({ "continue-on-delete-error": "true" });
    h.api.discover
      .mockResolvedValueOnce(discovery())
      .mockRejectedValueOnce(new CleanupError("inventory-read-failed", 403));
    const result = await h.run();
    expect(result.error).toEqual({
      code: "inventory-read-failed",
      status: 403,
    });
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("stops cancellation before preflight", async () => {
    const h = harness();
    h.controller.abort();
    expect((await h.run()).error).toEqual({ code: "execution-failed" });
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("stops deadline before preflight", async () => {
    const h = harness();
    expect(
      (
        await execute(
          h.api,
          h.input,
          now,
          h.controller.signal,
          () => now + h.input.timeoutMs,
        )
      ).error,
    ).toEqual({ code: "deadline" });
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("checks deadline again immediately before mutation", async () => {
    const h = harness();
    const clock = vi
      .fn()
      .mockReturnValueOnce(now)
      .mockReturnValue(now + h.input.timeoutMs);
    expect(
      (await execute(h.api, h.input, now, h.controller.signal, clock)).error,
    ).toEqual({ code: "deadline" });
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("checks cancellation again immediately before mutation", async () => {
    const h = harness();
    h.api.detail.mockImplementationOnce(async () => {
      h.controller.abort();
      return builds[3];
    });
    expect((await h.run()).error).toEqual({ code: "execution-failed" });
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("blocks originally eligible candidates when safety evidence is lost", async () => {
    const h = harness();
    const incomplete = discovery();
    incomplete.evidence = {
      ...incomplete.evidence,
      inventoryComplete: false,
      protectionComplete: false,
      eligibilityVerified: false,
    };
    h.api.discover
      .mockResolvedValueOnce(discovery())
      .mockResolvedValue(incomplete);
    expect(
      (await h.run()).decisions.filter((d) => d.disposition === "blocked"),
    ).toHaveLength(2);
    expect(h.api.requestDeletion).not.toHaveBeenCalled();
  });
  it("preserves no-application-code results safely", async () => {
    const h = harness();
    h.api.discover.mockResolvedValue(
      discovery([{ ...builds[0]!, applicationCode: undefined }]),
    );
    expect((await h.run()).decisions[0]).not.toHaveProperty("applicationCode");
  });
});
describe("safe execution error projection", () => {
  it("projects recognized input names while dropping arbitrary constructor text", () => {
    for (const input of ["retention-days", "client-secret", "identifier"])
      expect(safeError(new InputValidationError(input))).toEqual({
        code: "invalid-input",
        input,
      });
    for (const input of [
      "unrecognized-private-value",
      "__proto__",
      "constructor",
    ])
      expect(safeError(new InputValidationError(input))).toEqual({
        code: "invalid-input",
      });
  });
  it("preserves supported safe codes/status and drops raw unexpected messages", () => {
    expect(safeError(new CleanupError("known"))).toEqual({ code: "known" });
    expect(safeError(new CleanupError("known", 400))).toEqual({
      code: "known",
      status: 400,
    });
    expect(safeError(new Ccv2TransportError("REQUEST_FAILED"))).toMatchObject({
      code: "REQUEST_FAILED",
    });
    expect(safeError(new Error("client-secret"))).toEqual({
      code: "execution-failed",
    });
  });
});
