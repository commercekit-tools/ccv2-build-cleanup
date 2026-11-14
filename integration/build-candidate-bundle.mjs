import {
  cp,
  mkdtemp,
  mkdir,
  readdir,
  symlink,
  writeFile,
  readFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
const root = resolve(".");
const candidate = process.env.CLEANUP_CANDIDATE_PACKAGE;
if (!candidate)
  throw new Error("Prepare the exact-source candidate package first.");
const workspace = await mkdtemp(
  join(process.env.RUNNER_TEMP || tmpdir(), "cleanup-candidate-bundle-"),
);
for (const file of ["src", "package.json", "tsconfig.json"])
  await cp(join(root, file), join(workspace, file), { recursive: true });
await mkdir(join(workspace, "node_modules/@commercekit-tools"), {
  recursive: true,
});
for (const entry of await readdir(join(root, "node_modules"))) {
  if (entry === "@commercekit-tools") continue;
  await symlink(
    join(root, "node_modules", entry),
    join(workspace, "node_modules", entry),
    "junction",
  );
}
await symlink(
  join(root, "node_modules/@commercekit-tools/ccv2-client"),
  join(workspace, "node_modules/@commercekit-tools/ccv2-client"),
  "junction",
);
await symlink(
  candidate,
  join(workspace, "node_modules/@commercekit-tools/notification-contract"),
  "junction",
);
execFileSync(
  process.execPath,
  [
    join(root, "node_modules/@vercel/ncc/dist/ncc/cli.js"),
    "build",
    "src/index.ts",
    "--minify",
    "--license",
    "licenses.txt",
    "-o",
    "dist",
  ],
  { cwd: workspace, stdio: "inherit" },
);
const bundle = join(workspace, "dist/index.js");
await writeFile(
  join(workspace, "provenance.json"),
  JSON.stringify(
    {
      candidateOnly: true,
      bundleSha256: createHash("sha256")
        .update(await readFile(bundle))
        .digest("hex"),
      normalRegistryLockfileUnchanged: true,
    },
    null,
    2,
  ) + "\n",
);
if (process.env.CLEANUP_CANDIDATE_BUNDLE_FILE)
  await writeFile(process.env.CLEANUP_CANDIDATE_BUNDLE_FILE, bundle + "\n");
process.stdout.write(`Candidate-only bundle: ${bundle}\n`);
