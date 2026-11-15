import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseNotificationEventJson } from "@commercekit-tools/notification-contract";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run, type ActionCore } from "../../src/action.js";
import { createCleanupNotification } from "../../src/reporting/notification.js";
import { Sanitizer, writeReport } from "../../src/reporting/result.js";
import { cleanupInputNames } from "../../src/reporting/input-context.js";
import { build, rawInputs, start } from "../fixtures/builds.js";
vi.mock("../../src/reporting/notification.js", async (original) => {
  const actual =
    await original<typeof import("../../src/reporting/notification.js")>();
  return {
    ...actual,
    createCleanupNotification: vi.fn(actual.createCleanupNotification),
  };
});
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
function cleanupEvent(output: Record<string, unknown>) {
  const event = parseNotificationEventJson(
    String(output["notification-event"]),
  );
  if (event.eventType !== "ccv2.build-cleanup.completed")
    throw new Error("Expected cleanup event.");
  return event;
}
beforeEach(async () => {
  const actual = await vi.importActual<
    typeof import("../../src/reporting/notification.js")
  >("../../src/reporting/notification.js");
  vi.mocked(createCleanupNotification)
    .mockReset()
    .mockImplementation(actual.createCleanupNotification);
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
        "notification-event": expect.any(String),
      });
      expect(x.core.setFailed).not.toHaveBeenCalled();
      expect(
        vi.mocked(x.core.getInput).mock.calls.map(([name]) => name),
      ).toEqual(cleanupInputNames);
      const event = cleanupEvent(x.output);
      expect(event.status).toBe("warning");
      expect(event.data.inputsValidated).toBe(true);
      expect(event.data.inputsTruncated).toBe(false);
      expect(Object.keys(event.data.inputs!)).toEqual(cleanupInputNames);
      expect(event.data.inputs).toMatchObject({
        "token-endpoint": "[REDACTED]",
        "client-id": "[REDACTED]",
        "client-secret": "[REDACTED]",
        resource: "[REDACTED]",
        "subscription-code": "sub",
        "api-base-url": "https://portalapi.commerce.ondemand.com/",
        "retention-days": "30",
        "keep-latest": "10",
        "max-deletions": "20",
        "timeout-minutes": "15",
        "continue-on-delete-error": "false",
      });
      expect(event.data.issues?.[0]).toMatchObject({
        code: "eligibility-unverified",
        message: expect.stringContaining("four-hour"),
      });
      for (const secret of [
        ...Object.values(rawInputs).slice(0, 4),
        "runtime-token",
      ])
        expect(JSON.stringify(x.output)).not.toContain(secret);
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
    const event = cleanupEvent(x.output);
    expect(event.status).toBe("failure");
    expect(event.data.mode).toBe("apply");
    expect(event.data.inputs?.["dry-run"]).toBe("false");
    expect(event.data.error).toMatchObject({
      code: "cleanup-blocked",
      message: expect.stringContaining("four-hour"),
    });
    expect(
      Math.max(...vi.mocked(x.core.setOutput).mock.invocationCallOrder),
    ).toBeLessThan(vi.mocked(x.core.setFailed).mock.invocationCallOrder[0]!);
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
      const event = cleanupEvent(x.output);
      expect(event.status).toBe("failure");
      expect(event.data.inputsValidated).toBe(true);
      expect(Object.keys(event.data.inputs!)).toEqual(cleanupInputNames);
      expect(event.data.error?.message).toContain(
        `HTTP ${options.failure ?? options.tokenFailure}`,
      );
    },
  );
  it("preserves invalid input outputs before failing", async () => {
    const x = setup({ "retention-days": "bad" });
    await run(x.core, {}, undefined, x.runtime);
    expect(x.calls).toHaveLength(0);
    expect(x.output["dry-run"]).toBe("true");
    expect(x.output["cleanup-status"]).toBe("failed");
    const event = cleanupEvent(x.output);
    expect(event.status).toBe("failure");
    expect(event.data.inputsValidated).toBe(false);
    expect(Object.keys(event.data.inputs!)).toEqual(cleanupInputNames);
    expect(event.data.inputs?.["retention-days"]).toBe("bad");
    expect(event.data.inputs?.["subscription-code"]).toBe("sub");
    expect(event.data.error).toMatchObject({
      code: "invalid-input",
      message: expect.stringContaining("Invalid retention-days input."),
    });
    expect(event.data.error?.message).toContain("integer from 1 to 36500");
    expect(JSON.parse(String(x.output["result-json"])).error).toEqual({
      code: "invalid-input",
      input: "retention-days",
    });
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
  it("emits a validated shared warning matching the cleanup result", async () => {
    const x = setup({ "application-code": "app" });
    await run(x.core, {}, undefined, x.runtime);
    const event = parseNotificationEventJson(
      String(x.output["notification-event"]),
    );
    expect(event.eventType).toBe("ccv2.build-cleanup.completed");
    expect(event.status).toBe("warning");
    expect(event.data).toMatchObject({
      mode: "dry-run",
      subscriptionCode: "sub",
      applicationCode: "app",
      cleanupStatus: "blocked",
      scannedCount: x.output["scanned-count"],
      plannedCount: x.output["planned-count"],
      deletionRequestedCount: 0,
    });
    expect(x.core.warning).not.toHaveBeenCalledWith(
      expect.stringContaining("Notification event generation failed"),
    );
  });
  it("redacts received tokens and credential values repeated in valid public inputs", async () => {
    const x = setup({
      "application-code": "app",
      "exclude-build-codes": "runtime-token,secret-fixture",
      "timeout-minutes": "2",
      "max-deletions": "3",
    });
    await run(x.core, {}, undefined, x.runtime);
    const event = cleanupEvent(x.output);
    expect(event.status).toBe("warning");
    expect(event.data.inputs).toMatchObject({
      "application-code": "app",
      "exclude-build-codes": "[REDACTED], [REDACTED]",
      "timeout-minutes": "2",
      "max-deletions": "3",
    });
    expect(JSON.stringify(x.output)).not.toContain("runtime-token");
    expect(JSON.stringify(x.output)).not.toContain("secret-fixture");
    expect(x.calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
  });
  it("keeps invalid confidential input values out of useful configuration failure diagnostics", async () => {
    const badSecret = "synthetic-invalid-secret\ncredential";
    const x = setup({ "client-secret": badSecret });
    await run(x.core, {}, undefined, x.runtime);
    const event = cleanupEvent(x.output);
    expect(x.calls).toHaveLength(0);
    expect(event.status).toBe("failure");
    expect(event.data.inputs?.["client-secret"]).toBe("[REDACTED]");
    expect(event.data.inputsValidated).toBe(false);
    expect(event.data.error?.message).toContain("Invalid client-secret input.");
    expect(event.data.error?.message).toContain(
      "required authentication setting",
    );
    expect(JSON.stringify(x.output)).not.toContain(badSecret);
    expect(x.core.setSecret).toHaveBeenCalledWith(badSecret);
  });
  it("reports a bounded long exclusion input without broadening the selected scope", async () => {
    const codes = Array.from(
      { length: 1000 },
      (_, index) => `excluded-${index}`,
    );
    const x = setup({
      "application-code": "app",
      "exclude-build-codes": codes.join(","),
    });
    await run(x.core, {}, undefined, x.runtime);
    const event = cleanupEvent(x.output);
    expect(event.data.inputsValidated).toBe(true);
    expect(event.data.inputsTruncated).toBe(true);
    expect(event.data.inputs?.["exclude-build-codes"]).toHaveLength(256);
    expect(event.data.inputs?.["exclude-build-codes"]).toMatch(
      /… \[truncated\]$/,
    );
    expect(event.data.applicationCode).toBe("app");
    expect(event.data.scannedCount).toBe(1);
    expect(event.data.deletionRequestedCount).toBe(0);
  });
  it.each(["true", "false"])(
    "preserves cleanup outputs when input-context sanitization fails in dry-run=%s",
    async (dryRun) => {
      const temp = await mkdtemp(
        join(tmpdir(), "cleanup-input-context-failure-"),
      );
      const spy = vi
        .spyOn(Sanitizer.prototype, "input")
        .mockImplementationOnce(() => {
          throw new Error("secret-fixture");
        });
      try {
        const x = setup({ "dry-run": dryRun });
        await run(x.core, { RUNNER_TEMP: temp }, undefined, x.runtime);
        expect(x.output).toMatchObject({
          "cleanup-status": "blocked",
          "dry-run": dryRun,
          "scanned-count": 1,
          "deletion-requested-count": 0,
        });
        expect(x.core.warning).toHaveBeenCalledWith(
          "Input settings could not be sanitized; cleanup outcome is preserved.",
        );
        expect(x.calls.every((call) => call.method !== "DELETE")).toBe(true);
        expect(JSON.stringify(x.output)).not.toContain("secret-fixture");
        const event = cleanupEvent(x.output);
        expect(event.data.inputs).toBeUndefined();
        expect(event.status).toBe(dryRun === "true" ? "warning" : "failure");
        const report = JSON.parse(
          await readFile(String(x.output["report-path"]), "utf8"),
        );
        expect(report.status).toBe("blocked");
        expect(report.inputs).toBeUndefined();
        if (dryRun === "true") expect(x.core.setFailed).not.toHaveBeenCalled();
        else expect(x.core.setFailed).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        await rm(temp, { recursive: true, force: true });
      }
    },
  );
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
