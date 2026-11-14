import { describe, expect, it, vi } from "vitest";
import {
  createCcv2Client,
  TechnicalUserTokenManager,
  type RuntimeDependencies,
} from "@commercekit-tools/ccv2-client";
import { SapCleanupApi } from "../../src/api/index.js";
import { readInputs } from "../../src/inputs.js";
const start = Date.parse("2026-06-01T00:00:00Z");
const detail = {
  code: "old",
  subscriptionCode: "sub",
  status: "SUCCESS",
  deployed: false,
  hasSnapshot: false,
  buildStartTimestamp: "2026-01-01T00:00:00Z",
  buildEndTimestamp: "2026-01-02T00:00:00Z",
};
function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
interface Observed {
  url: URL;
  method: string;
  headers: Headers;
  body: string;
  redirect: "error" | "follow" | "manual" | undefined;
  credentials: "omit" | "same-origin" | "include" | undefined;
}
function shared(
  handler: (request: Observed, attempt: number) => Response | Promise<Response>,
  expiresIn = 3600,
) {
  const raw: Record<string, string> = {
    "token-endpoint": "https://auth.example.test/oauth/token",
    "client-id": "client&special",
    "client-secret": "secret +&=",
    resource: "resource with & spaces",
    "subscription-code": "sub",
    "api-base-url": "https://api.example.test",
  };
  const masks: string[] = [];
  const input = readInputs(
    (name) => raw[name] ?? "",
    (value) => masks.push(value),
  );
  const observed: Observed[] = [];
  const sleep = vi
    .fn<RuntimeDependencies["sleep"]>()
    .mockResolvedValue(undefined);
  let tokenRequests = 0,
    apiRequests = 0,
    clock = start;
  const runtime: RuntimeDependencies = {
    now: () => clock,
    random: () => 0,
    sleep,
    maskSecret: (value) => masks.push(value),
    fetch: async (url, init) => {
      const record: Observed = {
        url: new URL(String(url)),
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
        redirect: init?.redirect,
        credentials: init?.credentials,
      };
      observed.push(record);
      if (record.url.hostname === "auth.example.test")
        return json({
          access_token: `access-token-${++tokenRequests}`,
          token_type: "Bearer",
          expires_in: expiresIn,
        });
      return handler(record, ++apiRequests);
    },
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
    secrets: [input.clientId, input.clientSecret, input.resource],
  });
  const api = new SapCleanupApi(
    input,
    client,
    new AbortController().signal,
    start + input.timeoutMs,
  );
  return {
    api,
    input,
    observed,
    masks,
    sleep,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}
const targets = (observed: Observed[]) =>
  observed.filter((request) => request.url.hostname === "api.example.test");
describe("published shared CCv2 client contract", () => {
  it("maps exact credentials/resource to form OAuth and shared authentication headers, masking credentials and tokens", async () => {
    const h = shared(() => json(detail));
    await h.api.detail("old");
    await h.api.detail("old");
    const token = h.observed.filter(
      (request) => request.url.hostname === "auth.example.test",
    );
    expect(token).toHaveLength(1);
    expect(token[0]!.method).toBe("POST");
    expect(token[0]!.headers.get("content-type")).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(Object.fromEntries(new URLSearchParams(token[0]!.body))).toEqual({
      client_id: h.input.clientId,
      client_secret: h.input.clientSecret,
      grant_type: "client_credentials",
      resource: h.input.resource,
    });
    for (const request of targets(h.observed)) {
      expect(request.url.pathname).toBe("/v2/subscriptions/sub/builds/old");
      expect(request.headers.get("x-approuter-authorization")).toBe(
        "Bearer access-token-1",
      );
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.redirect).toBe("error");
      expect(request.credentials).toBe("omit");
    }
    expect(h.masks.every((value) => typeof value === "string")).toBe(true);
    for (const secret of [
      h.input.clientId,
      h.input.clientSecret,
      h.input.resource,
      h.input.tokenEndpoint,
      "access-token-1",
    ])
      expect(h.masks).toContain(secret);
  });
  it("uses shared in-memory token expiry/refresh rather than new local token state", async () => {
    const h = shared(() => json(detail), 30);
    await h.api.detail("old");
    h.advance(28000);
    await h.api.detail("old");
    expect(
      h.observed.filter((request) => request.method === "POST"),
    ).toHaveLength(2);
    expect(
      targets(h.observed).map((request) =>
        request.headers.get("x-approuter-authorization"),
      ),
    ).toEqual(["Bearer access-token-1", "Bearer access-token-2"]);
    expect(h.masks).toContain("access-token-2");
  });
  it.each([429, 500, 503])(
    "safe-read policy delegates retry/backoff for HTTP %s to the shared transport",
    async (status) => {
      const h = shared((_request, attempt) =>
        attempt === 1 ? json({}, status, { "retry-after": "2" }) : json(detail),
      );
      expect(await h.api.detail("old")).toEqual(detail);
      expect(targets(h.observed)).toHaveLength(2);
      expect(h.sleep).toHaveBeenCalledOnce();
      expect(h.sleep.mock.calls[0]![0]).toBe(2000);
      expect(
        h.observed.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    },
  );
  it("safe-read retries remain bounded by the shared policy", async () => {
    const h = shared(() => json({}, 500));
    await expect(h.api.detail("old")).rejects.toMatchObject({
      code: "detail-read-failed",
      status: 500,
    });
    expect(targets(h.observed)).toHaveLength(3);
    expect(h.sleep).toHaveBeenCalledTimes(2);
  });
  it("safe-read uses exactly one explicit 401 refresh/replay", async () => {
    const h = shared((_request, attempt) =>
      attempt === 1 ? json({}, 401) : json(detail),
    );
    expect(await h.api.detail("old")).toEqual(detail);
    expect(
      targets(h.observed).map((request) =>
        request.headers.get("x-approuter-authorization"),
      ),
    ).toEqual(["Bearer access-token-1", "Bearer access-token-2"]);
    expect(
      h.observed.filter((request) => request.method === "POST"),
    ).toHaveLength(2);
    expect(h.sleep).not.toHaveBeenCalled();
  });
  it("repeated 401 terminates after one shared refresh", async () => {
    const h = shared(() => json({}, 401));
    await expect(h.api.detail("old")).rejects.toMatchObject({
      code: "authorization-failure",
      status: 401,
    });
    expect(targets(h.observed)).toHaveLength(2);
    expect(
      h.observed.filter((request) => request.method === "POST"),
    ).toHaveLength(2);
  });
  it.each([401, 403])(
    "unsafe DELETE HTTP %s is never replayed or refreshed",
    async (status) => {
      const h = shared(() => json({}, status));
      await expect(h.api.requestDeletion("old")).rejects.toMatchObject({
        code: "authorization-failure",
        status,
      });
      expect(targets(h.observed)).toHaveLength(1);
      expect(
        h.observed.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
      expect(h.sleep).not.toHaveBeenCalled();
    },
  );
  it.each([429, 500, 502, 503])(
    "unsafe-mutation policy never retries DELETE HTTP %s",
    async (status) => {
      const h = shared(() => json({}, status));
      expect(await h.api.requestDeletion("old")).toBe(status);
      expect(targets(h.observed)).toHaveLength(1);
      expect(targets(h.observed)[0]!.method).toBe("DELETE");
      expect(h.sleep).not.toHaveBeenCalled();
    },
  );
  it("unsafe-mutation network loss never replays and shared errors discard raw secrets", async () => {
    const h = shared(() => {
      throw new Error("secret +&= should never escape fetch");
    });
    const error = await h.api
      .requestDeletion("old")
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ code: "REQUEST_FAILED" });
    expect(JSON.stringify(error)).not.toContain("secret");
    expect(targets(h.observed)).toHaveLength(1);
    expect(h.sleep).not.toHaveBeenCalled();
  });
  it("accepts a true empty 204 and preserves encoded path identifiers", async () => {
    const h = shared(() => new Response(null, { status: 204 }));
    expect(await h.api.requestDeletion("old α%")).toBe(204);
    expect(targets(h.observed)[0]!.url.pathname).toBe(
      "/v2/subscriptions/sub/builds/old%20%CE%B1%25",
    );
  });
});
