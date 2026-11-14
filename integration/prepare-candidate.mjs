import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  appendFile,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const expected = "9aeded72cf1faaf4441a24ff8c9510daab06e2ca";
const source = process.env.CLEANUP_ACTION_KIT_PATH;
if (!source)
  throw new Error(
    "Set CLEANUP_ACTION_KIT_PATH to an action-kit checkout at the documented base SHA.",
  );
const patch = fileURLToPath(
  new URL("./action-kit-cleanup-event.patch", import.meta.url),
);
const env = {
  ...process.env,
  PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ""}`,
};
const command = (name, args, cwd, capture = false) =>
  execFileSync(name, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });
const head = command("git", ["rev-parse", "HEAD"], source, true).trim();
if (head !== expected)
  throw new Error(
    "Candidate source checkout does not match the audited base SHA.",
  );
if (
  command(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    source,
    true,
  ).trim()
)
  throw new Error("Candidate source checkout has tracked changes.");
const workspace = await mkdtemp(
  join(process.env.RUNNER_TEMP || tmpdir(), "cleanup-notification-candidate-"),
);
const candidate = join(workspace, "action-kit");
await cp(resolve(source), candidate, {
  recursive: true,
  filter: (path) =>
    ![".git", "node_modules", "coverage", "dist", ".idea"].includes(
      basename(path),
    ),
});
command("git", ["apply", "--check", patch], candidate);
command("git", ["apply", patch], candidate);
command("pnpm", ["install", "--frozen-lockfile"], candidate);
command(
  "pnpm",
  ["exec", "tsc", "-p", "packages/notification-contract/tsconfig.json"],
  candidate,
);
const packageRoot = join(candidate, "packages/notification-contract");
command(process.execPath, ["../../scripts/copy-schema.mjs"], packageRoot);
command("pnpm", ["exec", "tsc", "--noEmit", "-p", "tsconfig.json"], candidate);
command("pnpm", ["exec", "vitest", "run"], candidate);
const packed = JSON.parse(
  command(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--json",
      "--cache",
      join(workspace, "npm-cache"),
      "--pack-destination",
      workspace,
    ],
    packageRoot,
    true,
  ),
);
if (
  !Array.isArray(packed) ||
  packed.length !== 1 ||
  basename(packed[0].filename) !== packed[0].filename
)
  throw new Error("Invalid candidate pack result.");
const tarball = join(workspace, packed[0].filename);
const bytes = await readFile(tarball);
const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
const installed = join(workspace, "installed");
await mkdir(installed);
await writeFile(
  join(installed, "package.json"),
  JSON.stringify({
    name: "isolated-cleanup-notification-validation",
    version: "0.0.0",
    private: true,
    type: "module",
  }) + "\n",
);
command(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--registry",
    "https://registry.npmjs.org",
    "--cache",
    join(workspace, "npm-cache"),
    tarball,
  ],
  installed,
);
const packagePath = join(
  installed,
  "node_modules/@commercekit-tools/notification-contract",
);
const provenance = {
  candidateOnly: true,
  actionKitBaseSha: head,
  patchSha256: createHash("sha256")
    .update(await readFile(patch))
    .digest("hex"),
  tarballIntegrity: integrity,
  tarball,
  packagePath,
};
await writeFile(
  join(workspace, "provenance.json"),
  JSON.stringify(provenance, null, 2) + "\n",
);
if (process.env.GITHUB_ENV)
  await appendFile(
    process.env.GITHUB_ENV,
    `CLEANUP_CANDIDATE_PACKAGE=${packagePath}\n`,
  );
if (process.env.CLEANUP_CANDIDATE_PATH_FILE)
  await writeFile(process.env.CLEANUP_CANDIDATE_PATH_FILE, packagePath + "\n");
process.stdout.write(
  `Candidate validation package: ${packagePath}\nCandidate integrity: ${integrity}\n`,
);
