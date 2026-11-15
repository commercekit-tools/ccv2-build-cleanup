import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const version = "0.0.5";
const contractCommit = "3f9e418556b190bb8d55ac11a22f554e2c51a4a5";
const expectedIntegrity =
  "sha512-SMcyyWaeHdtlztt99xtWlJycSAspSTGvCaWJH7M2+u+on77JHwo8boTBOc9UUC0BQHDPo/VHmOj4gpt/XIbqmw==";
const expectedSha256 =
  "9c3b9910dc51be697c3aa4e44620c3cd87d3cdd132f9a5431e85f9cb5f712dec";
assert.equal(
  process.versions.node.split(".")[0],
  "24",
  "Use Node 24 for candidate validation.",
);
for (const name of [
  "CANDIDATE_CONTRACT_TARBALL",
  "NOTIFY_SOURCE_PATH",
  "CLEANUP_SANDBOX_PATH",
]) {
  assert(
    process.env[name],
    `Set ${name} to the reviewed local validation input.`,
  );
}
const tarball = resolve(process.env.CANDIDATE_CONTRACT_TARBALL);
assert(tarball.endsWith(".tgz"));
const bytes = await readFile(tarball);
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  expectedSha256,
  "Candidate SHA256 mismatch.",
);
assert.equal(
  `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
  expectedIntegrity,
  "Candidate integrity mismatch.",
);
const manifest = JSON.parse(
  execFileSync("tar", ["-xOf", tarball, "package/package.json"], {
    encoding: "utf8",
  }),
);
assert.equal(manifest.name, "@commercekit-tools/notification-contract");
assert.equal(manifest.version, version);
const temp = await mkdtemp(join(tmpdir(), "commercekit-notification-context-"));
const sandbox = resolve(process.env.CLEANUP_SANDBOX_PATH);
const command = (cwd, bin, args, env = {}) =>
  execFileSync(bin, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
const git = (cwd, args) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
async function consumer(source, name) {
  const destination = join(temp, name);
  await mkdir(destination);
  const paths = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: source, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
  for (const path of new Set(paths)) {
    assert(!isAbsolute(path) && !path.split("/").includes(".."));
    const entry = join(source, path);
    const stat = await lstat(entry);
    assert(
      stat.isFile() && !stat.isSymbolicLink(),
      "Only repository files may enter the candidate workspace.",
    );
    await mkdir(dirname(join(destination, path)), { recursive: true });
    await copyFile(entry, join(destination, path));
  }
  const packagePath = join(destination, "package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  assert.equal(packageJson.private, true);
  assert.equal(
    packageJson.dependencies["@commercekit-tools/notification-contract"],
    "0.0.4",
    "Normal source must remain on the published dependency.",
  );
  packageJson.dependencies["@commercekit-tools/notification-contract"] =
    `file:${tarball}`;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  command(destination, "git", ["init", "--quiet"]);
  command(destination, "pnpm", ["install"]);
  command(destination, "pnpm", ["bundle"]);
  command(destination, "pnpm", ["quality"], {
    COMMERCEKIT_CANDIDATE_CONTRACT_VERSION: version,
    CLEANUP_SANDBOX_PATH: sandbox,
  });
  const bundle = await readFile(join(destination, "dist/index.js"));
  return {
    sourceCommit: git(source, ["rev-parse", "HEAD"]),
    sourceDirty: Boolean(git(source, ["status", "--porcelain"])),
    bundleSha256: createHash("sha256").update(bundle).digest("hex"),
    commands: [
      "pnpm install (isolated file:tarball dependency)",
      "pnpm bundle",
      "COMMERCEKIT_CANDIDATE_CONTRACT_VERSION=0.0.5 pnpm quality",
    ],
    workspace: destination,
  };
}
const cleanup = await consumer(root, "cleanup");
const notify = await consumer(
  resolve(process.env.NOTIFY_SOURCE_PATH),
  "notify",
);
const evidence = {
  schemaVersion: 1,
  classification:
    "unpublished-source-candidate; not registry/release readiness",
  contract: {
    version,
    sourceCommit: contractCommit,
    sha256: expectedSha256,
    integrity: expectedIntegrity,
  },
  cleanup,
  notify,
  sandbox: {
    sourceCommit: git(sandbox, ["rev-parse", "HEAD"]),
    tree: git(sandbox, ["rev-parse", "HEAD^{tree}"]),
  },
  publicationAuthorized: false,
};
const evidencePath = join(temp, "validation.json");
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
  mode: 0o600,
});
console.log(
  `PASS: isolated notification candidate validated. Evidence: ${evidencePath}`,
);
console.log(
  "Normal manifests, lockfiles and bundles were not changed; registry readiness remains BLOCKED.",
);
