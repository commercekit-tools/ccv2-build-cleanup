import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, type ActionCore } from "../../src/action.js";
import { createCleanupNotification } from "../../src/reporting/notification.js";
import { writeReport } from "../../src/reporting/result.js";
import { build, rawInputs, start } from "../fixtures/builds.js";
vi.mock("../../src/reporting/notification.js", () => ({
  createCleanupNotification: vi.fn(() => undefined),
}));
vi.mock("../../src/reporting/result.js", async (original) => ({
  ...(await original<typeof import("../../src/reporting/result.js")>()),
  writeReport: vi.fn((...args: Parameters<typeof writeReport>) =>
    import("../../src/reporting/result.js")
      .then(() =>
        vi.importActual<typeof import("../../src/reporting/result.js")>(
          "../../src/reporting/result.js",
        ),
      )
      .then((m) => m.writeReport(...args)),
  ),
}));
function setup(
  overrides: Record<string, string> = {},
  options: { failure?: number; tokenFailure?: number } = {},
) {
  const output: Record<string, unknown> = {};
  const summaries: string[] = [];
  const core: ActionCore = {
    getInput: vi.fn((name) => ({ ...rawInputs, ...overrides })[name] ?? ""),
    setSecret: vi.fn(),
    setOutput: vi.fn((name, value) => {
      output[name] = value;
    }),
    setFailed: vi.fn(),
    warning: vi.fn(),
    summary: {
      addRaw: (text) => {
        summaries.push(text);
      },
      write: vi.fn(async () => undefined),
    },
  };
  const calls: {
    url: string;
    method: string;
    headers: Headers;
    body: string;
  }[] = [];
  const fetch = vi.fn(
    async (url: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
      const target = String(url);
      calls.push({
        url: target,
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      });
      if (target.includes("oauth/token"))
        return Response.json(
          options.tokenFailure
            ? {}
            : {
                access_token: "runtime-token",
                token_type: "bearer",
                expires_in: 3600,
              },
          { status: options.tokenFailure ?? 200 },
        );
      if (options.failure)
        return Response.json(
          { detail: "secret-fixture" },
          { status: options.failure },
        );
      const isBuilds = target.includes("/builds?");
      return Response.json({
        value: isBuilds ? [build()] : [],
        count: isBuilds ? 1 : 0,
      });
    },
  );
  const runtime = {
    fetch: fetch as typeof globalThis.fetch,
    now: () => start,
    sleep: vi.fn(async () => {}),
    random: () => 0,
  };
  return { core, output, summaries, runtime, calls };
}
beforeEach(() => {
  vi.mocked(createCleanupNotification).mockReset().mockReturnValue(undefined);
});
describe("real shared authentication and action reporting", () => {
  it("maps credential/resource form, masks credentials/tokens and performs zero mutations", async () => {
    const temp = await mkdtemp(join(tmpdir(), "cleanup-test-"));
    try {
      const x = setup();
      await run(x.core, { RUNNER_TEMP: temp }, undefined, x.runtime);
      const oauth = x.calls[0]!;
      const form = new URLSearchParams(oauth.body);
      expect(Object.fromEntries(form)).toEqual({
        client_id: "client-fixture",
        client_secret: "secret-fixture",
        grant_type: "client_credentials",
        resource: "resource-fixture",
      });
      expect(oauth.headers.get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
      expect(
        x.calls
          .slice(1)
          .every(
            (c) =>
              c.method === "GET" &&
              c.headers.get("x-approuter-authorization") ===
                "Bearer runtime-token" &&
              !c.headers.has("authorization"),
          ),
      ).toBe(true);
      for (const secret of [
        ...Object.values(rawInputs).slice(0, 4),
        "runtime-token",
      ])
        expect(x.core.setSecret).toHaveBeenCalledWith(secret);
      expect(x.output).toMatchObject({
        "cleanup-status": "blocked",
        "dry-run": "true",
        "scanned-count": 1,
        "deletion-requested-count": 0,
        "notification-event": "",
      });
      expect(x.core.setFailed).not.toHaveBeenCalled();
      expect(x.summaries.join("")).toContain("DRY RUN");
      const report = await readFile(String(x.output["report-path"]), "utf8");
      expect(report).not.toContain("secret-fixture");
      expect(report).not.toContain("runtime-token");
      expect(JSON.parse(report).decisions[0].reasons).toContain(
        "eligibility-unverified",
      );
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
  it("passes only credential fields to shared authentication, preserving IDs resembling policy values", async () => {
    const temp = await mkdtemp(join(tmpdir(), "cleanup-auth-projection-"));
    try {
      const x = setup({
        "keep-latest": "1",
        "max-deletions": "2",
        "exclude-build-codes": "old",
      });
      await run(x.core, { RUNNER_TEMP: temp }, undefined, x.runtime);
      expect(
        JSON.parse(String(x.output["result-json"])).decisions[0].code,
      ).toBe("old");
      expect(
        vi
          .mocked(x.core.setSecret)
          .mock.calls.every(([value]) => typeof value === "string"),
      ).toBe(true);
      for (const [value] of vi.mocked(x.core.setSecret).mock.calls)
        expect([
          ...Object.values(rawInputs).slice(0, 4),
          "runtime-token",
        ]).toContain(value);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
  it("apply fails closed, writes outputs and then action failure", async () => {
    const x = setup({ "dry-run": "false" });
    await run(x.core, {}, undefined, x.runtime);
    expect(x.output["cleanup-status"]).toBe("blocked");
    expect(x.core.setFailed).toHaveBeenCalled();
    expect(x.calls.every((c) => c.method !== "DELETE")).toBe(true);
    expect(x.core.setOutput).toHaveBeenCalledWith(
      "result-json",
      expect.any(String),
    );
  });
  it.each([{ failure: 403 }, { tokenFailure: 401 }])(
    "preserves handled authentication/read failures %j",
    async (options) => {
      const x = setup({}, options);
      await run(x.core, {}, undefined, x.runtime);
      expect(x.output["cleanup-status"]).toBe("failed");
      expect(x.output["scanned-count"]).toBe(0);
      expect(x.core.setFailed).toHaveBeenCalled();
      expect(JSON.stringify(x.output)).not.toContain("secret-fixture");
    },
  );
  it("preserves invalid input outputs before failing", async () => {
    const x = setup({ "retention-days": "bad" });
    await run(x.core, {}, undefined, x.runtime);
    expect(x.calls).toHaveLength(0);
    expect(x.output["dry-run"]).toBe("true");
    expect(x.output["cleanup-status"]).toBe("failed");
  });
  it("keeps cleanup outcome when notification, report or summary fails", async () => {
    const x = setup();
    vi.mocked(createCleanupNotification).mockImplementation(() => {
      throw Error("private error");
    });
    vi.mocked(writeReport).mockRejectedValueOnce(Error("write failure"));
    vi.mocked(x.core.summary.write).mockRejectedValueOnce(
      Error("summary failure"),
    );
    await run(x.core, {}, undefined, x.runtime);
    expect(x.output["cleanup-status"]).toBe("blocked");
    expect(x.output["report-path"]).toBe("");
    expect(x.core.warning).toHaveBeenCalledWith(
      "Notification event generation failed; cleanup outcome is preserved.",
    );
    expect(x.core.warning).toHaveBeenCalledWith(
      "Job summary could not be written; cleanup outputs are preserved.",
    );
  });
  it("preserves a valid candidate event output", async () => {
    const x = setup();
    vi.mocked(createCleanupNotification).mockReturnValue(
      '{"candidate":"valid"}',
    );
    await run(x.core, {}, undefined, x.runtime);
    expect(x.output["notification-event"]).toBe('{"candidate":"valid"}');
    expect(x.core.warning).not.toHaveBeenCalledWith(
      expect.stringContaining("unpublished"),
    );
  });
  it("supports cancellation before inventory", async () => {
    const x = setup();
    const controller = new AbortController();
    controller.abort();
    await run(x.core, {}, controller.signal, x.runtime);
    expect(x.calls).toHaveLength(0);
    expect(x.output["cleanup-status"]).toBe("failed");
  });
  it("uses default runtime arguments on handled invalid config", async () => {
    const x = setup({ "subscription-code": "" });
    await run(x.core);
    expect(x.output["cleanup-status"]).toBe("failed");
  });
});
