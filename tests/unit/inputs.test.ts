import { describe, expect, it } from "vitest";
import {
  bounds,
  consumerDryRun,
  identifier,
  readInputs,
} from "../../src/inputs.js";

const configured = {
  "token-endpoint": "https://auth.example.test/oauth/token",
  "client-id": "client",
  "client-secret": "secret",
  resource: "resource",
  "subscription-code": "subscription",
};
function read(
  overrides: Record<string, string> = {},
  mask: (value: string) => void = () => {},
) {
  const values: Record<string, string> = { ...configured, ...overrides };
  return readInputs((name) => values[name] ?? "", mask);
}
describe("inputs", () => {
  it("defaults safe values and matches existing technical-user names", () => {
    expect(read()).toEqual({
      tokenEndpoint: configured["token-endpoint"],
      clientId: "client",
      clientSecret: "secret",
      resource: "resource",
      subscriptionCode: "subscription",
      apiBaseUrl: "https://portalapi.commerce.ondemand.com/",
      retentionDays: 30,
      keepLatest: 10,
      maxDeletions: 20,
      timeoutMs: 900000,
      dryRun: true,
      continueOnDeleteError: false,
      excludeBuildCodes: [],
    });
    expect(Object.isFrozen(read())).toBe(true);
    readInputs((name) => (configured as Record<string, string>)[name] ?? "");
  });
  it("accepts valid strict configuration and normalizes exclusions", () => {
    const result = read({
      "application-code": " app ",
      "subscription-code": " subscription ",
      "exclude-build-codes": " a,b\na\r\nc, ,\n",
      "dry-run": "false",
      "continue-on-delete-error": "true",
      "retention-days": "36500",
      "keep-latest": "10000",
      "max-deletions": "100",
      "timeout-minutes": "60",
      "api-base-url": "https://api.example.test",
    });
    expect(result).toMatchObject({
      applicationCode: "app",
      excludeBuildCodes: ["a", "b", "c"],
      dryRun: false,
      continueOnDeleteError: true,
      retentionDays: bounds.retentionDays,
      keepLatest: bounds.keepLatest,
      maxDeletions: bounds.maxDeletions,
      timeoutMs: bounds.timeoutMinutes * 60000,
    });
    expect(Object.isFrozen(result.excludeBuildCodes)).toBe(true);
  });
  it.each([
    "retention-days",
    "keep-latest",
    "max-deletions",
    "timeout-minutes",
  ])("rejects malformed %s", (name) => {
    for (const value of [
      "0",
      "-1",
      "1.5",
      "NaN",
      "Infinity",
      "1e2",
      "0x10",
      " 1",
      "1 ",
      "+1",
      "01",
      "9007199254740993",
      "999999999999999999999999999999999999",
    ])
      expect(() => read({ [name]: value })).toThrow();
  });
  it.each([
    ["retention-days", "36501"],
    ["keep-latest", "10001"],
    ["max-deletions", "101"],
    ["timeout-minutes", "61"],
  ])("rejects exceeded %s bound", (name, value) =>
    expect(() => read({ [name!]: value! })).toThrow(),
  );
  it.each(["dry-run", "continue-on-delete-error"])(
    "rejects malformed boolean %s",
    (name) => {
      for (const value of [
        "True",
        "FALSE",
        "1",
        "0",
        "yes",
        " true",
        "false ",
        "null",
      ])
        expect(() => read({ [name]: value })).toThrow();
    },
  );
  it.each(Object.keys(configured).filter((key) => key !== "subscription-code"))(
    "validates credential %s after masking all credentials",
    (name) => {
      const masked: string[] = [];
      expect(() =>
        read({ [name]: "bad\nvalue" }, (value) => masked.push(value)),
      ).toThrow();
      expect(masked).toHaveLength(4);
      expect(() => read({ [name]: "" })).toThrow();
      expect(() => read({ [name]: " " })).toThrow();
      expect(() => read({ [name]: "x".repeat(8193) })).toThrow();
    },
  );
  it.each([
    "http://api.example.test",
    "https://a.test/v2",
    "https://user:pass@a.test",
    "https://a.test?token=x",
    "https://a.test#frag",
    "https://a.test\\path",
  ])("rejects malformed API URL %s", (value) =>
    expect(() => read({ "api-base-url": value })).toThrow(),
  );
  it("rejects invalid auth endpoint", () =>
    expect(() => read({ "token-endpoint": "http://auth.test" })).toThrow());
  it.each([
    "",
    ".",
    "..",
    "a/b",
    "a?b",
    "a#b",
    "a\\b",
    "a\n",
    " a",
    "a ",
    "x".repeat(129),
    "\ud800",
  ])("validates path identifier %j", (value) =>
    expect(() => identifier(value)).toThrow(),
  );
  it("uses shared encoding validation and preserves exact identifiers", () =>
    expect(identifier("app α%")).toBe("app α%"));
  it("rejects invalid application/exclusion/subscription identifiers", () => {
    for (const name of [
      "application-code",
      "exclude-build-codes",
      "subscription-code",
    ])
      expect(() => read({ [name]: "bad/value" })).toThrow();
  });
  it("bounds exclusion count and input length", () => {
    expect(() =>
      read({
        "exclude-build-codes": Array.from(
          { length: 10001 },
          (_, index) => `b${index}`,
        ).join(","),
      }),
    ).toThrow();
    expect(() =>
      read({ "exclude-build-codes": "x".repeat(129 * bounds.exclusions + 1) }),
    ).toThrow();
  });
});

describe("scheduled consumer deletion enablement", () => {
  it.each([
    ["", "schedule", undefined, true],
    ["false", "schedule", undefined, true],
    ["TRUE", "schedule", undefined, true],
    ["true ", "schedule", undefined, true],
    ["true", "schedule", undefined, false],
    ["true", "workflow_dispatch", true, true],
    ["true", "workflow_dispatch", "true", true],
    ["true", "workflow_dispatch", false, false],
    ["true", "workflow_dispatch", "false", false],
    ["true", "workflow_dispatch", undefined, true],
    ["true", "workflow_dispatch", "", true],
    ["true", "workflow_dispatch", "False", true],
    ["true", "workflow_dispatch", 0, true],
    ["true", "pull_request", false, true],
    ["", "workflow_dispatch", false, true],
  ])(
    "enabled=%j event=%j manual=%j -> dry-run=%j",
    (enabled, event, manual, expected) =>
      expect(consumerDryRun(enabled as string, event as string, manual)).toBe(
        expected,
      ),
  );
});
