import { readInputs } from "../../src/inputs.js";
export const start = Date.parse("2026-11-13T00:00:00Z");
export const rawInputs: Record<string, string> = {
  "token-endpoint": "https://auth.example.test/oauth/token",
  "client-id": "client-fixture",
  "client-secret": "secret-fixture",
  resource: "resource-fixture",
  "subscription-code": "sub",
};
export const inputs = (overrides: Record<string, string> = {}) =>
  readInputs((name) => ({ ...rawInputs, ...overrides })[name] ?? "");
export const build = (code = "old", extra: Record<string, unknown> = {}) => ({
  code,
  subscriptionCode: "sub",
  applicationCode: "app",
  status: "SUCCESS",
  buildStartTimestamp: "2025-01-01T00:00:00Z",
  buildEndTimestamp: "2025-01-02T00:00:00Z",
  deployed: false,
  hasSnapshot: false,
  ...extra,
});
