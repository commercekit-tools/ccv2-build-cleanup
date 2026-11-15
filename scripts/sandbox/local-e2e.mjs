import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNotificationEventJson } from "@commercekit-tools/notification-contract";
import contractMetadata from "@commercekit-tools/notification-contract/package.json" with { type: "json" };
import contractSchema from "@commercekit-tools/notification-contract/schema" with { type: "json" };

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const checkout = process.env.CLEANUP_SANDBOX_PATH;
assert(
  checkout,
  "Set CLEANUP_SANDBOX_PATH to the isolated checkout of the pinned sandbox commit.",
);
const bundle = join(root, "dist/index.js");
assert.equal(contractMetadata.version, "0.0.6");
assert(
  contractSchema.properties.eventType.enum.includes(
    "ccv2.build-cleanup.completed",
  ),
);
const app = join(checkout, "apps/ccv2");
const temp = await mkdtemp(join(tmpdir(), "cleanup-sandbox-e2e-"));
const port = Number(process.env.CLEANUP_SANDBOX_PORT ?? "18787");
assert(
  Number.isInteger(port) && port >= 1024 && port <= 65535,
  "Invalid local test port.",
);
const base = `https://localhost:${port}`;
let server;
const runs = [];
let ca;

async function request(path, method = "GET", data, headers = {}) {
  const body = data === undefined ? undefined : JSON.stringify(data);
  return await new Promise((resolveRequest, reject) => {
    const req = https.request(
      `${base}${path}`,
      {
        method,
        ca,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        timeout: 10000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          resolveRequest({
            status: response.statusCode,
            body: text ? JSON.parse(text) : undefined,
          });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("Local request timed out.")));
    req.on("error", reject);
    req.end(body);
  });
}
const subscription = "131762872233634f29fdeb7d50983aa4";
const build = (code, index = 0, fields = {}) => ({
  code,
  subscriptionCode: subscription,
  applicationCode: "commerce",
  status: "SUCCESS",
  buildStartTimestamp: new Date(Date.UTC(2020, 0, 1, 0, index)).toISOString(),
  buildEndTimestamp: new Date(Date.UTC(2020, 0, 1, 1, index)).toISOString(),
  deployed: false,
  hasSnapshot: false,
  ...fields,
});
async function create(fixture, faults = []) {
  const created = await request("/sandbox/v1/runs", "POST");
  assert.equal(created.status, 201);
  const run = created.body;
  runs.push(run);
  const headers = { Authorization: `Bearer ${run.controlToken}` };
  const seeded = await request(
    `/sandbox/v1/runs/${run.runId}/cleanup-fixture`,
    "PUT",
    fixture,
    headers,
  );
  assert.equal(seeded.status, 200);
  if (faults.length) {
    const scenario = (
      await request(
        `/sandbox/v1/runs/${run.runId}/scenario`,
        "GET",
        undefined,
        headers,
      )
    ).body;
    assert.equal(
      (
        await request(
          `/sandbox/v1/runs/${run.runId}/scenario`,
          "PUT",
          { ...scenario, faults },
          headers,
        )
      ).status,
      200,
    );
  }
  return run;
}
async function action(run, inputs = {}, expectedExit = 0) {
  const directory = await mkdtemp(join(temp, "action-"));
  const output = join(directory, "outputs");
  const summary = join(directory, "summary");
  await writeFile(output, "");
  await writeFile(summary, "");
  const values = {
    "token-endpoint": run.credentials.tokenUrl,
    "client-id": run.credentials.clientId,
    "client-secret": run.credentials.clientSecret,
    resource: run.credentials.resource,
    "subscription-code": subscription,
    "api-base-url": base,
    "retention-days": "30",
    "keep-latest": "10",
    "max-deletions": "2",
    ...inputs,
  };
  const env = {
    ...process.env,
    NODE_EXTRA_CA_CERTS: join(temp, "cert.pem"),
    RUNNER_TEMP: directory,
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_REPOSITORY: "commercekit-tools/ccv2-build-cleanup",
    GITHUB_RUN_ID: "42",
    GITHUB_SERVER_URL: "https://github.com",
  };
  for (const [name, value] of Object.entries(values))
    env[`INPUT_${name.toUpperCase()}`] = value;
  const child = spawn(process.execPath, [bundle], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Never include captured output in assertions: local Action mask commands contain synthetic secrets.
  child.stdout.resume();
  child.stderr.resume();
  const timer = setTimeout(() => child.kill("SIGKILL"), 45000);
  const code = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", resolveExit);
  });
  clearTimeout(timer);
  const raw = await readFile(output, "utf8");
  const outputs = {};
  const lines = raw.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const match = /^([^<]+)<<(.+)$/.exec(lines[index]);
    if (!match) continue;
    const content = [];
    while (++index < lines.length && lines[index] !== match[2])
      content.push(lines[index]);
    outputs[match[1]] = content.join("\n");
  }
  const result = JSON.parse(outputs["result-json"]);
  if (code !== expectedExit) {
    const observed = await request(
      `/sandbox/v1/runs/${run.runId}/state`,
      "GET",
      undefined,
      { Authorization: `Bearer ${run.controlToken}` },
    );
    assert.equal(
      code,
      expectedExit,
      `Unexpected bundled action exit code: ${result.status}, ${result.error?.code ?? "no error code"}, HTTP ${result.error?.status}; counters ${JSON.stringify(observed.body?.faultCounters)}.`,
    );
  }
  const notification = outputs["notification-event"];
  assert(
    notification,
    "The selected contract bundle must emit a notification event.",
  );
  assert(Buffer.byteLength(notification, "utf8") <= 65536);
  for (const secret of [...Object.values(run.credentials), run.controlToken])
    assert(
      !notification.includes(secret),
      "Notification output must not contain credentials or control tokens.",
    );
  const event = parseNotificationEventJson(notification, { maxBytes: 65536 });
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.eventType, "ccv2.build-cleanup.completed");
  assert.equal(event.source.component, "ccv2-build-cleanup");
  assert.equal(event.occurredAt, result.runStartedAt);
  assert.equal(
    event.status,
    result.status === "blocked" &&
      result.dryRun &&
      result.completeness.inventory
      ? "warning"
      : ["dry-run", "no-op", "success"].includes(result.status)
        ? "success"
        : "failure",
  );
  assert.equal(event.data.mode, result.dryRun ? "dry-run" : "apply");
  assert.equal(event.data.cleanupStatus, result.status);
  assert.equal(event.data.subscriptionCode, result.scope.subscriptionCode);
  assert.equal(event.data.applicationCode, result.scope.applicationCode);
  assert.equal(event.data.retentionDays, result.policy.retentionDays);
  assert.equal(event.data.keepLatest, result.policy.keepLatest);
  assert.equal(event.data.durationMs, result.durationMs);
  for (const [eventCount, resultCount] of Object.entries({
    scannedCount: "scanned",
    eligibleCount: "eligible",
    plannedCount: "planned",
    deletionRequestedCount: "deletionRequested",
    skippedCount: "skipped",
    failedCount: "failed",
    unknownCount: "unknown",
    deferredCount: "deferred",
  }))
    assert.equal(event.data[eventCount], result.counts[resultCount]);
  if (result.error) assert.equal(event.data.error?.code, result.error.code);
  else if (event.status === "failure") assert(event.data.error?.message);
  assert.equal(event.data.inputsValidated, true);
  assert.equal(Object.keys(event.data.inputs).length, 14);
  assert.deepEqual(event.data.inputs, result.inputs);
  assert.equal(event.data.protectedCount, result.counts.protected);
  assert.equal(
    event.data.blockedCount,
    result.decisions.filter((decision) => decision.disposition === "blocked")
      .length,
  );
  for (const key of [
    "token-endpoint",
    "client-id",
    "client-secret",
    "resource",
  ])
    assert.equal(event.data.inputs[key], "[REDACTED]");
  if (event.status === "warning") {
    assert(
      event.data.issues.some(
        (issue) => issue.code === "eligibility-unverified",
      ),
    );
    assert.equal(event.data.error, undefined);
  }
  assert.equal(
    event.context?.repository,
    "commercekit-tools/ccv2-build-cleanup",
  );
  assert.equal(event.context?.runId, "42");
  assert.equal(
    event.context?.runUrl,
    "https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/42",
  );
  const report = JSON.parse(await readFile(outputs["report-path"], "utf8"));
  assert.deepEqual(report.counts, result.counts);
  const markdown = await readFile(summary, "utf8");
  assert(
    markdown.includes(inputs["dry-run"] === "false" ? "APPLY" : "DRY RUN"),
  );
  assert(
    markdown.includes(
      event.status === "warning"
        ? "⚠️"
        : event.status === "failure"
          ? "❌"
          : "✅",
    ),
  );
  for (const name of Object.keys(result.inputs))
    assert(markdown.includes(name));
  for (const label of [
    "Scanned",
    "Eligible",
    "Planned",
    "Deletion requests accepted",
    "Skipped",
    "Protected",
    "Blocked",
    "Deferred",
    "Failed",
    "Unknown",
    "Safety evidence",
  ])
    assert(markdown.includes(label));
  for (const issue of event.data.issues ?? [])
    assert(markdown.includes(issue.code));
  for (const secret of [
    run.credentials.clientId,
    run.credentials.clientSecret,
    run.credentials.resource,
    run.credentials.tokenUrl,
    run.controlToken,
  ])
    assert(!markdown.includes(secret));
  for (const secret of [run.credentials.clientSecret, run.controlToken])
    assert(!JSON.stringify(report).includes(secret));
  const state = (
    await request(`/sandbox/v1/runs/${run.runId}/state`, "GET", undefined, {
      Authorization: `Bearer ${run.controlToken}`,
    })
  ).body;
  const mutations = Object.entries(state.faultCounters).filter(([key]) =>
    /^(?:create|delete|update)/.test(key),
  );
  assert.deepEqual(
    mutations,
    [],
    "Cleanup must perform zero target API mutations while production eligibility remains unverified.",
  );
  assert.equal(result.counts.deletionRequested, 0);
  assert.equal(result.completeness.eligibility, false);
  return { result, outputs, state };
}

try {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(temp, "key.pem"),
      "-out",
      join(temp, "cert.pem"),
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { stdio: "ignore" },
  );
  ca = await readFile(join(temp, "cert.pem"));
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const envFile = join(temp, "sandbox.env");
  const vars = {
    MOCK_JWT_ISSUER: base,
    MOCK_JWT_PRIVATE_KEY: pair.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }),
    MOCK_JWT_PUBLIC_JWK: JSON.stringify(
      pair.publicKey.export({ format: "jwk" }),
    ),
    MOCK_JWT_KID: "cleanup-local-test",
    RUN_TOKEN_SIGNING_KEY: "synthetic-local-only-signing-key-for-cleanup-e2e",
  };
  await writeFile(
    envFile,
    Object.entries(vars)
      .map(
        ([key, value]) =>
          `${key}=${key === "MOCK_JWT_PUBLIC_JWK" ? "'" + value + "'" : JSON.stringify(value)}`,
      )
      .join("\n"),
    { mode: 0o600 },
  );
  server = spawn(
    process.execPath,
    [
      join(app, "node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--inspector-port",
      "0",
      "--local-protocol",
      "https",
      "--https-key-path",
      join(temp, "key.pem"),
      "--https-cert-path",
      join(temp, "cert.pem"),
      "--env-file",
      envFile,
      "--persist-to",
      join(temp, "state"),
      "--show-interactive-dev-session=false",
    ],
    {
      cwd: app,
      env: {
        ...process.env,
        WRANGLER_LOG_PATH: join(temp, "wrangler.log"),
        WRANGLER_SEND_METRICS: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.resume();
  server.stderr.resume();
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await request("/sandbox/v1/health")).status === 200) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  assert(ready, "Local sandbox did not become ready.");
  const builds = Array.from({ length: 105 }, (_, index) => ({
    code: `b${index}`,
    response: build(`b${index}`, index),
  }));
  builds[0].response.deployed = true;
  builds[1].response.hasSnapshot = true;
  builds[2].response.status = "BUILDING";
  builds[3].response.status = "UNKNOWN";
  builds[4].response.status = "DELETED";
  builds[5].response.buildEndTimestamp = new Date().toISOString();
  const deployments = [
    ["scheduled", "b7", "d1", "SCHEDULED"],
    ["current", "b8", "s1", "DEPLOYED"],
    ["historical", "b9", "p1", "FAIL"],
  ].map(([code, buildCode, environmentCode, status]) => ({
    code,
    response: {
      code,
      subscriptionCode: subscription,
      buildCode,
      environmentCode,
      status,
      strategy: "ROLLING_UPDATE",
      createdTimestamp: "2020-01-01T00:00:00.000Z",
      isCanaryAvailable: false,
    },
  }));
  const mixed = await create({ builds, deployments });
  const first = await action(mixed, { "exclude-build-codes": "b6" });
  assert.equal(first.result.counts.scanned, 105);
  assert.equal(first.result.status, "blocked");
  const reasons = (code) =>
    first.result.decisions.find((item) => item.code === code).reasons;
  assert(reasons("b0").includes("deployed"));
  assert(reasons("b1").includes("snapshot-or-backup-reference"));
  assert(reasons("b2").includes("active-build"));
  assert(reasons("b3").includes("active-build"));
  assert(reasons("b4").includes("already-marked-for-deletion"));
  assert(reasons("b5").includes("retained-age"));
  assert(reasons("b6").includes("explicitly-excluded"));
  assert(reasons("b104").includes("retained-latest"));
  assert(reasons("b7").includes("active-deployment-reference"));
  assert(reasons("b8").includes("active-deployment-reference"));
  assert(!reasons("b9").includes("active-deployment-reference"));
  assert(
    first.state.faultCounters["getBuilds:"] >= 4,
    "Both inventory passes must fetch multiple pages.",
  );
  assert(
    first.state.faultCounters["issueToken:"] >= 1,
    "The actual shared OAuth flow must authenticate.",
  );
  const repeat = await action(mixed, { "exclude-build-codes": "b6" });
  assert.deepEqual(repeat.result.decisions, first.result.decisions);
  await action(mixed, { "dry-run": "false" }, 1);
  const emptyScope = await action(mixed, {
    "application-code": "absent-application",
  });
  assert.equal(emptyScope.result.counts.scanned, 0);
  const invalid = await create({
    builds: [{ code: "bad", response: build("bad", 0, { deployed: "false" }) }],
  });
  assert.equal(
    (await action(invalid, {}, 1)).result.error.code,
    "invalid-api-response",
  );
  const unstable = await create({
    builds: builds.slice(0, 3),
    changes: [
      { operationId: "getBuilds", onCall: 2, buildCode: "b0", remove: true },
    ],
  });
  assert.equal(
    (await action(unstable, {}, 1)).result.error.code,
    "incomplete-inventory",
  );
  const retry = await create({ builds: builds.slice(0, 2) }, [
    {
      operationId: "getBuilds",
      status: 429,
      onCalls: [1],
      retryAfterSeconds: 1,
    },
    { operationId: "getEnvironments", status: 500, onCalls: [1] },
  ]);
  const recovered = await action(retry);
  assert.equal(recovered.result.counts.scanned, 2);
  assert(recovered.state.faultCounters["getBuilds:"] >= 3);
  const denied = await create({ builds: builds.slice(0, 2) }, [
    { operationId: "getBuilds", status: 403, onCalls: [1] },
  ]);
  assert.equal(
    (await action(denied, {}, 1)).result.error.code,
    "authorization-failure",
  );
  const refresh = await create({ builds: [] }, [
    { operationId: "getBuilds", status: 401, onCalls: [1] },
  ]);
  assert((await action(refresh)).state.faultCounters["issueToken:"] >= 2);
  process.stdout.write(
    "PASS: bundled action local sandbox; OAuth, refresh, retries, 105-build pagination, protections, repeat run, exact scope, invalid fields, instability, authorization, valid cleanup notification context, outputs, and zero target mutations.\n",
  );
} finally {
  for (const run of runs) {
    const removed = await request(
      `/sandbox/v1/runs/${run.runId}`,
      "DELETE",
      undefined,
      { Authorization: `Bearer ${run.controlToken}` },
    );
    assert.equal(removed.status, 204, "Sandbox run cleanup failed.");
  }
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolveExit) => {
      server.once("exit", resolveExit);
      setTimeout(resolveExit, 3000).unref();
    });
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  await rm(temp, { recursive: true, force: true });
}
