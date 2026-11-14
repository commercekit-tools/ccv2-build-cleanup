import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";
const exec = promisify(execFile);
it.skipIf(!process.env.CLEANUP_SANDBOX_PATH)(
  "executes the actual bundle against the existing local sandbox candidate",
  async () => {
    const { stdout } = await exec(
      process.execPath,
      ["scripts/sandbox/local-e2e.mjs"],
      { timeout: 180000, maxBuffer: 65536 },
    );
    expect(stdout).toContain("PASS: bundled action local sandbox");
  },
  190000,
);
