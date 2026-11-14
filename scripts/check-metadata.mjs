import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { parse } from "yaml";
const action = parse(await readFile("action.yml", "utf8"));
assert.equal(action.runs.using, "node24");
assert.equal(action.runs.main, "dist/index.js");
assert.equal(action.inputs["dry-run"].default, "true");
const source = await readFile("src/reporting/result.ts", "utf8");
for (const key of Object.keys(action.outputs))
  assert(
    source.includes(`'${key}'`) || source.includes(`"${key}"`),
    `Missing output ${key}`,
  );
for (const dir of [".github/workflows", "examples"])
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".yml")) continue;
    const workflow = parse(await readFile(`${dir}/${file}`, "utf8"));
    assert(workflow.on && workflow.jobs, `Invalid workflow ${file}`);
    assert.equal(workflow.permissions.contents, "read");
    assert(!workflow.on.pull_request_target);
    for (const job of Object.values(workflow.jobs)) {
      assert(job["timeout-minutes"] > 0 && job["timeout-minutes"] <= 30);
      for (const step of job.steps ?? [])
        if (step.uses && !step.uses.startsWith("./"))
          assert(
            /@[a-f0-9]{40}$/.test(step.uses) ||
              (dir === "examples" && step.uses.includes("@REPLACE_WITH_")),
            `Unpinned action ${step.uses}`,
          );
    }
  }
console.log("Action metadata and workflow policy checks passed.");
