import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { sanitizeBoundedText } from "@commercekit-tools/notification-contract";
import {
  captureInputValues,
  cleanupInputNames,
  snapshotInputContext,
} from "../../src/reporting/input-context.js";
import { inputs, rawInputs } from "../fixtures/builds.js";
import { Sanitizer } from "../../src/reporting/result.js";

const defaultSafe = new Sanitizer(() => {});
const sharedSanitize = (value: string, max: number) =>
  defaultSafe.input(value, max);
const capture = (overrides: Record<string, string> = {}) =>
  captureInputValues(
    (name) => ({ ...rawInputs, ...overrides })[name] ?? "",
    () => {},
  );

describe("cleanup input context", () => {
  it("covers every existing Action input without changing the metadata", async () => {
    const metadata = parse(
      await readFile(new URL("../../action.yml", import.meta.url), "utf8"),
    );
    expect(cleanupInputNames).toEqual(Object.keys(metadata.inputs));
  });
  it("captures all fourteen names once and masks each credential before another read", () => {
    const calls: string[] = [];
    const raw = captureInputValues(
      (name) => {
        calls.push(`read:${name}`);
        return rawInputs[name] ?? "";
      },
      (value) => calls.push(`mask:${value}`),
    );
    expect(Object.keys(raw)).toEqual(cleanupInputNames);
    expect(Object.isFrozen(cleanupInputNames)).toBe(true);
    expect(Object.isFrozen(raw)).toBe(true);
    expect(calls.slice(0, 8)).toEqual([
      "read:token-endpoint",
      `mask:${rawInputs["token-endpoint"]}`,
      "read:client-id",
      `mask:${rawInputs["client-id"]}`,
      "read:client-secret",
      `mask:${rawInputs["client-secret"]}`,
      "read:resource",
      `mask:${rawInputs.resource}`,
    ]);
    expect(calls.slice(8)).toEqual(
      cleanupInputNames.slice(4).map((name) => `read:${name}`),
    );
    expect(raw).toMatchObject(rawInputs);
  });

  it("retains missing credentials as input data without masking empty values", () => {
    const mask = vi.fn();
    const raw = captureInputValues(() => "", mask);
    expect(mask).not.toHaveBeenCalled();
    expect(Object.values(raw)).toEqual(Array(14).fill(""));
    const snapshot = snapshotInputContext(raw, undefined, sharedSanitize);
    expect(snapshot.inputs["client-secret"]).toBe("[REDACTED]");
    expect(snapshot.inputs["subscription-code"]).toBe("(not provided)");
    expect(snapshot.inputsValidated).toBe(false);
  });

  it("does not swallow input retrieval failures or expose partial data", () => {
    const read = vi.fn((name: string) => {
      if (name === "client-secret")
        throw new Error("synthetic retrieval failure");
      return rawInputs[name] ?? "";
    });
    const mask = vi.fn();
    expect(() => captureInputValues(read, mask)).toThrow(
      "synthetic retrieval failure",
    );
    expect(read.mock.calls.map(([name]) => name)).toEqual([
      "token-endpoint",
      "client-id",
      "client-secret",
    ]);
    expect(mask.mock.calls.map(([value]) => value)).toEqual([
      rawInputs["token-endpoint"],
      rawInputs["client-id"],
    ]);
  });

  it("uses normalized effective values and preserves false settings after validation", () => {
    const supplied = {
      "application-code": " app ",
      "subscription-code": " sub ",
      "api-base-url": "https://api.example.test",
      "retention-days": "45",
      "keep-latest": "12",
      "max-deletions": "7",
      "dry-run": "false",
      "continue-on-delete-error": "true",
      "timeout-minutes": "3",
      "exclude-build-codes": " first,second\nfirst ",
    };
    const snapshot = snapshotInputContext(
      capture(supplied),
      inputs(supplied),
      sharedSanitize,
    );
    expect(snapshot).toEqual({
      inputsValidated: true,
      inputsTruncated: false,
      inputs: {
        "token-endpoint": "[REDACTED]",
        "client-id": "[REDACTED]",
        "client-secret": "[REDACTED]",
        resource: "[REDACTED]",
        "subscription-code": "sub",
        "api-base-url": "https://api.example.test/",
        "application-code": "app",
        "retention-days": "45",
        "keep-latest": "12",
        "dry-run": "false",
        "max-deletions": "7",
        "exclude-build-codes": "first, second",
        "timeout-minutes": "3",
        "continue-on-delete-error": "true",
      },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.inputs)).toBe(true);
  });

  it("shows existing defaults and explicit empty application/exclusions", () => {
    const snapshot = snapshotInputContext(capture(), inputs(), sharedSanitize);
    expect(snapshot.inputs).toMatchObject({
      "api-base-url": "https://portalapi.commerce.ondemand.com/",
      "application-code": "(all applications)",
      "retention-days": "30",
      "keep-latest": "10",
      "dry-run": "true",
      "max-deletions": "20",
      "exclude-build-codes": "(none)",
      "timeout-minutes": "15",
      "continue-on-delete-error": "false",
    });
  });

  it("reports supplied invalid values without silently making whitespace a default", () => {
    const supplied = capture({
      "retention-days": "malformed",
      "keep-latest": "  ",
      "dry-run": "FALSE",
      "subscription-code": "\n",
    });
    const snapshot = snapshotInputContext(supplied, undefined, sharedSanitize);
    expect(snapshot.inputsValidated).toBe(false);
    expect(snapshot.inputsTruncated).toBe(false);
    expect(snapshot.inputs).toMatchObject({
      "retention-days": "malformed",
      "keep-latest": "(blank)",
      "dry-run": "FALSE",
      "subscription-code": "(blank)",
      "api-base-url": "https://portalapi.commerce.ondemand.com",
    });
    expect(
      snapshotInputContext(undefined, undefined, sharedSanitize).inputs,
    ).toEqual(
      snapshotInputContext(
        captureInputValues(
          () => "",
          () => {},
        ),
        undefined,
        sharedSanitize,
      ).inputs,
    );
  });

  it("always hides authentication and redacts secrets appearing in public settings before bounds", () => {
    const token = "received-token-fixture";
    const auth = Object.values(rawInputs).slice(0, 4);
    const secret = rawInputs["client-secret"]!;
    const raw = capture({
      "subscription-code": `scope-${secret}`,
      "application-code": `Bearer ${token}`,
      "exclude-build-codes": `${secret},${encodeURIComponent(secret)},${"x".repeat(300)}`,
    });
    const calls: string[] = [];
    const safe = new Sanitizer(() => {});
    for (const value of [...auth, token]) safe.add(value);
    const snapshot = snapshotInputContext(raw, undefined, (value, max) => {
      calls.push(value);
      return safe.input(value, max);
    });
    const serialized = JSON.stringify(snapshot);
    for (const value of [...auth, token])
      expect(serialized).not.toContain(value);
    expect(snapshot.inputs["subscription-code"]).toBe("scope-[REDACTED]");
    expect(snapshot.inputs["application-code"]).toBe("Bearer [REDACTED]");
    expect(snapshot.inputs["exclude-build-codes"]).toContain("[REDACTED]");
    expect(snapshot.inputs["exclude-build-codes"]).toMatch(/… \[truncated\]$/);
    expect(snapshot.inputsTruncated).toBe(true);
    expect(calls).not.toContain(raw["token-endpoint"]);
    expect(calls).not.toContain(raw["client-id"]);
    expect(calls).not.toContain(raw["client-secret"]);
    expect(calls).not.toContain(raw.resource);
  });

  it("retains public API origins while hiding credential-bearing URLs and JWT-shaped settings", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.synthetic.signature";
    const safe = new Sanitizer(() => {});
    const snapshot = snapshotInputContext(
      capture({
        "api-base-url": "https://user:unregistered-secret@api.example.test/",
        "application-code": token,
        "exclude-build-codes":
          "https://api.example.test/?access_token=unregistered-token",
      }),
      undefined,
      (value, max) => safe.input(value, max),
    );
    const text = JSON.stringify(snapshot);
    expect(text).not.toContain("unregistered-secret");
    expect(text).not.toContain("unregistered-token");
    expect(text).not.toContain(token);
    expect(snapshot.inputs["api-base-url"]).toBe("[URL]");
    expect(snapshot.inputs["application-code"]).toBe("[REDACTED]");
    expect(snapshot.inputs["exclude-build-codes"]).toBe("[URL]");
    const valid = snapshotInputContext(capture(), inputs(), (value, max) =>
      safe.input(value, max),
    );
    expect(valid.inputs["api-base-url"]).toBe(
      "https://portalapi.commerce.ondemand.com/",
    );
  });

  it("shows a blank diagnostic when the supplied shared sanitizer removes invalid control content", () => {
    const snapshot = snapshotInputContext(
      capture({ "application-code": "\u0000" }),
      undefined,
      (value, max) => sanitizeBoundedText(value, max),
    );
    expect(snapshot.inputs["application-code"]).toBe("(blank)");
    expect(snapshot.inputsValidated).toBe(false);
    expect(snapshot.inputsTruncated).toBe(false);
  });

  it("distinguishes an exact 256-character value from a visibly truncated longer value", () => {
    for (const [length, truncated] of [
      [256, false],
      [257, true],
    ] as const) {
      const value = "a".repeat(length);
      const snapshot = snapshotInputContext(
        capture({ "application-code": value }),
        undefined,
        sharedSanitize,
      );
      expect(snapshot.inputsTruncated).toBe(truncated);
      expect(snapshot.inputs["application-code"]).toHaveLength(256);
      if (truncated)
        expect(snapshot.inputs["application-code"]).toMatch(/… \[truncated\]$/);
      else expect(snapshot.inputs["application-code"]).toBe(value);
    }
  });

  it("bounds a maximum-sized validated exclusion list while keeping its source immutable", () => {
    const codes = Array.from({ length: 10000 }, (_, index) => `build-${index}`);
    const validated = inputs({ "exclude-build-codes": codes.join(",") });
    const snapshot = snapshotInputContext(undefined, validated, sharedSanitize);
    expect(snapshot.inputsTruncated).toBe(true);
    expect(snapshot.inputs["exclude-build-codes"]).toHaveLength(256);
    expect(snapshot.inputs["exclude-build-codes"]).toMatch(/^build-0, build-1/);
    expect(validated.excludeBuildCodes).toEqual(codes);
    expect(
      Object.values(snapshot.inputs).every((value) => value.length <= 256),
    ).toBe(true);
    expect(Object.keys(snapshot.inputs)).toEqual(cleanupInputNames);
  });
});
