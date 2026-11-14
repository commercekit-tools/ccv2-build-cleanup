import { describe, it, expect, vi } from "vitest";
import {
  SapCleanupApi,
  projectBuild,
  object,
  limits,
} from "../../src/api/index.js";
import type { Ccv2Client, Ccv2Response } from "@commercekit-tools/ccv2-client";
import { inputs, build, start } from "../fixtures/builds.js";
const reply = (value: unknown, status = 200): Ccv2Response => ({
  status,
  body: { kind: "json", value },
  retryAfterMs: 0,
});
function setup(
  handler: (path: string) => Ccv2Response = (path) =>
    reply({
      value: path.startsWith("v2/subscriptions/sub/builds") ? [build()] : [],
      count: path.startsWith("v2/subscriptions/sub/builds") ? 1 : 0,
    }),
) {
  const request = vi.fn(async (path: string) => handler(path));
  const controller = new AbortController();
  return {
    api: new SapCleanupApi(
      inputs(),
      { request } as Ccv2Client,
      controller.signal,
      start + 60000,
    ),
    request,
    controller,
  };
}
describe("untrusted endpoint projections", () => {
  it.each([null, [], 1, "x"])("rejects nonobject %s", (value) =>
    expect(() => object(value)).toThrow("invalid-api-response"),
  );
  it.each([
    { code: null },
    { code: "../x" },
    { subscriptionCode: "other" },
    { status: null },
    { status: "" },
    { status: "x".repeat(129) },
    { applicationCode: [] },
    { buildStartTimestamp: 23 },
    { buildEndTimestamp: "x".repeat(65) },
    { deployed: "false" },
    { hasSnapshot: 0 },
  ])("rejects malformed fields %j", (extra) =>
    expect(() => projectBuild(build("x", extra), "sub")).toThrow(
      "invalid-api-response",
    ),
  );
  it("projects only needed fields and preserves missing flags", () => {
    const b = projectBuild(
      build("x", {
        secret: "omit",
        deployed: undefined,
        hasSnapshot: undefined,
        subscriptionCode: undefined,
        applicationCode: undefined,
        buildStartTimestamp: undefined,
        buildEndTimestamp: undefined,
      }),
      "sub",
    );
    expect(b).toEqual({
      code: "x",
      subscriptionCode: "sub",
      status: "SUCCESS",
    });
    expect(Object.isFrozen(b)).toBe(true);
  });
});
describe("complete bounded discovery", () => {
  it("uses documented queries, reads twice and leaves eligibility unverified", async () => {
    const { api, request } = setup();
    const discovery = await api.discover();
    expect(discovery.builds).toHaveLength(1);
    expect(discovery.evidence).toMatchObject({
      inventoryComplete: true,
      protectionComplete: true,
      eligibilityVerified: false,
    });
    expect(request).toHaveBeenCalledTimes(4);
    for (const [path, opts] of request.mock.calls as unknown as [
      string,
      { policy: string; method: string; refreshOn401: boolean },
    ][]) {
      const q = new URL(path, "https://api.test");
      if (q.pathname.endsWith("/environments")) expect(q.search).toBe("");
      else {
        expect(q.searchParams.get("$top")).toBe("100");
        expect(q.searchParams.get("$skip")).toBe("0");
        expect(q.searchParams.get("$count")).toBe("true");
      }
      expect(opts).toMatchObject({
        policy: "safe-read",
        method: "GET",
        refreshOn401: true,
      });
    }
  });
  it("reads all pages including empty boundary page", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => build(String(i)));
    const { api } = setup((path) => {
      const u = new URL(path, "https://api.test");
      return reply({
        value: u.pathname.endsWith("/builds")
          ? rows.slice(Number(u.searchParams.get("$skip")))
          : [],
        count: u.pathname.endsWith("/builds") ? 100 : 0,
      });
    });
    expect((await api.discover()).builds).toHaveLength(100);
  });
  it.each([401, 403, 500])(
    "never maps read HTTP %s to empty",
    async (status) => {
      await expect(
        setup(() => reply({}, status)).api.discover(),
      ).rejects.toMatchObject({
        code:
          status === 500 ? "inventory-read-failed" : "authorization-failure",
        status,
      });
    },
  );
  it.each([
    { value: [], count: 1 },
    { value: [build(), build()], count: 2 },
    { value: [build(), build("old", { status: "FAIL" })], count: 2 },
    { value: [], count: -1 },
    { value: [], count: 10001 },
    { value: [], count: 0.5 },
    { value: [], count: "0" },
    { value: {} },
    { value: Array(101).fill(build()), count: 101 },
  ])("blocks unreliable page %j", async (body) => {
    await expect(setup(() => reply(body)).api.discover()).rejects.toThrow();
  });
  it("rejects empty/binary replies", async () => {
    await expect(
      setup(() => ({
        status: 200,
        body: { kind: "empty" },
        retryAfterMs: 0,
      })).api.discover(),
    ).rejects.toThrow("invalid-api-response");
  });
  it("detects count drift, repeated full pages, and second-pass drift", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => build(String(i)));
    for (const mode of ["count", "repeat", "pass"]) {
      let calls = 0;
      const { api } = setup((path) => {
        if (!path.includes("/builds?")) return reply({ value: [], count: 0 });
        calls++;
        return mode === "pass"
          ? reply({ value: [build(String(calls))], count: 1 })
          : reply({
              value: rows,
              count: mode === "count" && calls === 2 ? 201 : 200,
            });
      });
      await expect(api.discover()).rejects.toThrow("incomplete-inventory");
    }
  });
  it("enforces finite page and item bounds", async () => {
    const { api } = setup((path) => {
      const u = new URL(path, "https://api.test");
      const skip = Number(u.searchParams.get("$skip"));
      return reply({
        value: Array.from({ length: 100 }, (_, i) => build(String(skip + i))),
        count: 10000,
      });
    });
    await expect(api.discover()).rejects.toThrow("incomplete-inventory");
    expect(limits.pages).toBe(100);
  });
  it.each(["SCHEDULED", "DEPLOYING", "DEPLOYED", "UNDEPLOYED", "FAIL", "WHAT"])(
    "handles deployment status %s",
    async (status) => {
      const { api } = setup((path) =>
        reply({
          value: path.includes("/deployments?")
            ? [
                {
                  code: "d",
                  subscriptionCode: "sub",
                  buildCode: "old",
                  strategy: "ROLLING_UPDATE",
                  status,
                },
              ]
            : [],
          count: path.includes("/deployments?") ? 1 : 0,
        }),
      );
      const { evidence } = await api.discover();
      expect(evidence.activeDeploymentBuildCodes.has("old")).toBe(
        !["UNDEPLOYED", "FAIL"].includes(status),
      );
      expect(evidence.protectionComplete).toBe(status !== "WHAT");
    },
  );
  it.each([
    { strategy: "GREEN", status: "DEPLOYED" },
    { cancelation: { startTimestamp: "2026-01-01T00:00:00Z" }, status: "FAIL" },
  ])("blocks unproven operational relationships %j", async (extra) => {
    const { api } = setup((path) =>
      reply({
        value: path.includes("/deployments?")
          ? [{ code: "d", subscriptionCode: "sub", buildCode: "old", ...extra }]
          : [],
        count: path.includes("/deployments?") ? 1 : 0,
      }),
    );
    expect((await api.discover()).evidence.protectionComplete).toBe(false);
  });
  it.each([
    { subscriptionCode: "wrong" },
    { status: 2 },
    { status: "x".repeat(129) },
  ])("rejects invalid deployment %j", async (extra) => {
    const { api } = setup((path) =>
      reply({
        value: path.includes("/deployments?")
          ? [{ code: "d", subscriptionCode: "sub", buildCode: "old", ...extra }]
          : [],
        count: path.includes("/deployments?") ? 1 : 0,
      }),
    );
    await expect(api.discover()).rejects.toThrow("invalid-api-response");
  });
  it("rejects duplicated environment identity", async () => {
    const { api } = setup((path) =>
      reply(
        path.endsWith("/environments")
          ? {
              count: 2,
              value: [
                {
                  code: "d1",
                  subscriptionCode: "sub",
                  deploymentStatus: "UNDEPLOYED",
                },
                {
                  code: "d1",
                  subscriptionCode: "sub",
                  deploymentStatus: "UNDEPLOYED",
                },
              ],
            }
          : { count: 0, value: [] },
      ),
    );
    await expect(api.discover()).rejects.toThrow("invalid-api-response");
  });
  it.each(["UNDEPLOYED", "FAIL", "DEPLOYED", "DEPLOYING"])(
    "handles environment state %s",
    async (deploymentStatus) => {
      const { api } = setup((path) =>
        reply({
          value: path.endsWith("/environments")
            ? [{ code: "env", subscriptionCode: "sub", deploymentStatus }]
            : [],
          count: path.endsWith("/environments") ? 1 : 0,
        }),
      );
      expect((await api.discover()).evidence.protectionComplete).toBe(
        deploymentStatus !== "DEPLOYING",
      );
    },
  );
  it.each([
    { subscriptionCode: "bad", deploymentStatus: "DEPLOYED" },
    { subscriptionCode: "sub", deploymentStatus: 3 },
  ])("rejects invalid environment %j", async (row) => {
    const { api } = setup((path) =>
      reply({
        value: path.endsWith("/environments") ? [{ code: "env", ...row }] : [],
        count: path.endsWith("/environments") ? 1 : 0,
      }),
    );
    await expect(api.discover()).rejects.toThrow("invalid-api-response");
  });
});
describe("detail and unsafe mutation", () => {
  it("validates identity and handles absence", async () => {
    expect(await setup(() => reply(build())).api.detail("old")).toEqual(
      build(),
    );
    expect(await setup(() => reply({}, 404)).api.detail("old")).toBeUndefined();
    await expect(
      setup(() => reply(build("other"))).api.detail("old"),
    ).rejects.toThrow("invalid-api-response");
    await expect(setup(() => reply({}, 500)).api.detail("old")).rejects.toThrow(
      "detail-read-failed",
    );
    await expect(
      setup(() => ({
        status: 200,
        body: { kind: "empty" },
        retryAfterMs: 0,
      })).api.detail("old"),
    ).rejects.toThrow("invalid-api-response");
  });
  it("accepts empty 204 initiation and never enables 401 mutation replay", async () => {
    const { api, request } = setup(() => ({
      status: 204,
      body: { kind: "empty" },
      retryAfterMs: 0,
    }));
    expect(await api.requestDeletion("a b")).toBe(204);
    expect(request).toHaveBeenCalledWith(
      "v2/subscriptions/sub/builds/a%20b",
      expect.objectContaining({
        policy: "unsafe-mutation",
        method: "DELETE",
        refreshOn401: false,
      }),
    );
  });
  it("honors cancellation and request bound", async () => {
    const { api, controller } = setup();
    controller.abort();
    await expect(api.detail("old")).rejects.toThrow();
    const limited = setup(() => reply({}, 404));
    for (let i = 0; i < limits.requests; i++) await limited.api.detail("old");
    await expect(limited.api.detail("old")).rejects.toThrow("request-limit");
  });
});
