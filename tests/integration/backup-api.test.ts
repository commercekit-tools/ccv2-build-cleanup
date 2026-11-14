import { describe, expect, it } from "vitest";
import {
  createCcv2Client,
  TechnicalUserTokenManager,
} from "@commercekit-tools/ccv2-client";
import { SapCleanupApi } from "../../src/api/index.js";
import { readInputs } from "../../src/inputs.js";
const input = readInputs(
  (name) =>
    ({
      "token-endpoint": "https://auth.example/token",
      "client-id": "id",
      "client-secret": "secret",
      resource: "resource",
      "subscription-code": "sub",
    })[name] ?? "",
);
function api(backup: unknown, status = 200) {
  const paths: string[] = [];
  const runtime = {
    fetch: (async (url: string | URL | Request) => {
      const parsed = new URL(String(url));
      paths.push(parsed.pathname + parsed.search);
      if (parsed.hostname === "auth.example")
        return Response.json({
          access_token: "synthetic-token",
          token_type: "Bearer",
          expires_in: 3600,
        });
      if (parsed.pathname.endsWith("/environments"))
        return Response.json({
          count: 1,
          value: [
            {
              subscriptionCode: "sub",
              code: "d1",
              deploymentStatus: "UNDEPLOYED",
            },
          ],
        });
      if (parsed.pathname.endsWith("/databackups"))
        return backup instanceof Response
          ? backup
          : Response.json(backup, { status });
      return Response.json({ count: 0, value: [] });
    }) as typeof fetch,
  };
  const tokens = new TechnicalUserTokenManager(
    {
      tokenEndpoint: input.tokenEndpoint,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      resource: input.resource,
    },
    { runtime },
  );
  const client = createCcv2Client({
    baseUrl: input.apiBaseUrl,
    tokens,
    runtime,
  });
  return {
    api: new SapCleanupApi(
      input,
      client,
      new AbortController().signal,
      Date.now() + 60000,
    ),
    paths,
  };
}
describe("supported backup protection reads", () => {
  it("protects exact build references and accepts explicit null QUICK association", async () => {
    const value = api({
      count: 2,
      value: [
        {
          databackupCode: "backup1",
          buildCode: "old-build",
          databackupType: "STANDARD",
        },
        { databackupCode: "backup2", buildCode: null, databackupType: "QUICK" },
      ],
    });
    const discovery = await value.api.discover();
    expect([...discovery.evidence.snapshotOrBackupBuildCodes]).toEqual([
      "old-build",
    ]);
    expect(value.paths).toContain("/v2/subscriptions/sub/environments");
    expect(value.paths).toContain(
      "/v2/subscriptions/sub/environments/d1/databackups",
    );
    expect(
      value.paths
        .filter((path) => path.includes("databackups"))
        .every((path) => !path.includes("?")),
    ).toBe(true);
  });
  it.each([
    { count: 1, value: [{ databackupCode: "b" }] },
    {
      count: 1,
      value: [
        { databackupCode: "b", buildCode: null, databackupType: "STANDARD" },
      ],
    },
    { count: 1, value: [{ databackupCode: "b", buildCode: "invalid/path" }] },
    {
      count: 2,
      value: [
        { databackupCode: "b", buildCode: "build" },
        { databackupCode: "b", buildCode: "build" },
      ],
    },
    { count: -1, value: [] },
    {
      count: 101,
      value: Array.from({ length: 101 }, (_, index) => ({
        databackupCode: `b${index}`,
        buildCode: "build",
      })),
    },
    new Response("unexpected binary", {
      headers: { "Content-Type": "text/plain" },
    }),
    { count: 1, value: null },
    [],
  ])(
    "fails closed on malformed or missing backup association %j",
    async (body) => {
      await expect(api(body).api.discover()).rejects.toMatchObject({
        code: "invalid-api-response",
      });
    },
  );
  it("blocks a truncated backup inventory", async () => {
    await expect(
      api({
        count: 2,
        value: [{ databackupCode: "b", buildCode: "build" }],
      }).api.discover(),
    ).rejects.toMatchObject({ code: "incomplete-inventory" });
  });
  it("never converts permission failure into an empty backup set", async () => {
    await expect(api({}, 403).api.discover()).rejects.toMatchObject({
      code: "authorization-failure",
      status: 403,
    });
  });
  it("reports definitive backup read failure", async () => {
    await expect(api({}, 404).api.discover()).rejects.toMatchObject({
      code: "inventory-read-failed",
      status: 404,
    });
  });
});
