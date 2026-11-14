import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { it, expect } from "vitest";
it("executes the actual consumer enablement guard with strict case and input handling", async () => {
  const workflow = parse(
    await readFile("examples/scheduled-cleanup.yml", "utf8"),
  );
  const step = workflow.jobs.cleanup.steps.find(
    (s: { id?: string }) => s.id === "mode",
  );
  const code = step.run.split("node <<'NODE'\n")[1].split("\nNODE")[0];
  const temp = await mkdtemp(join(tmpdir(), "workflow-guard-"));
  try {
    for (const [enabled, event, input, expected] of [
      ["", "schedule", "null", true],
      ["false", "schedule", "false", true],
      ["TRUE", "schedule", "false", true],
      ["True", "workflow_dispatch", "false", true],
      ["true ", "schedule", "false", true],
      ["true", "schedule", "null", false],
      ["true", "workflow_dispatch", "true", true],
      ["true", "workflow_dispatch", "false", false],
      ["true", "workflow_dispatch", "null", true],
      ["true", "workflow_dispatch", "", true],
      ["true", "workflow_dispatch", '"false"', true],
      ["true", "workflow_dispatch", "0", true],
      ["true", "push", "false", true],
    ] as const) {
      const output = join(temp, String(Math.random()));
      execFileSync(process.execPath, ["-e", code], {
        env: {
          ...process.env,
          ENABLE_DELETION: enabled,
          EVENT_NAME: event,
          MANUAL_DRY_RUN_JSON: input,
          GITHUB_OUTPUT: output,
        },
      });
      expect(await readFile(output, "utf8")).toBe(`dry_run=${expected}\n`);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  expect(
    workflow.jobs.cleanup.steps.find((s: { id?: string }) => s.id === "cleanup")
      .with["dry-run"],
  ).toBe("${{ steps.mode.outputs.dry_run }}");
  expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  expect(workflow.on.schedule[0].cron).toBe("17 3 * * 0");
});
