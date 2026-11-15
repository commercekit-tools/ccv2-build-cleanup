# Validation report

> Current notification-context feature validation is recorded in
> [notification-context.md](notification-context.md). It uses an unpublished 0.0.5
> contract candidate; normal registry/bundle readiness is BLOCKED until separately
> authorized publication. The 0.0.4 evidence below is the earlier published baseline.

## Post-merge verification after PR #5 — 2026-11-14

**PASS:** [PR #5](https://github.com/commercekit-tools/ccv2-build-cleanup/pull/5)
merged at **18:36:45 UTC** as
`1e6eb8c5290572b55aa95a98c17ae45405572d64`. Both subsequent **push** workflows
completed successfully on that exact `refs/heads/main` commit:

| Check                       | Final evidence                                                                                                                | Job completion (UTC) |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `validate`                  | [Run 43627573533](https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/43627573533), job `132546792058`, PASS | 2026-11-14 18:37:37  |
| CodeQL workflow / `analyze` | [Run 43627573615](https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/43627573615), job `132546792431`, PASS | 2026-11-14 18:38:06  |

The main validation log confirms **300/300 tests in 14/14 files, zero skipped,
and 100% statement/branch/function/line coverage**. Frozen package installation,
format/lint/strict types, local sandbox E2E, committed-bundle consistency,
metadata/actionlint, public scan and full dependency audit passed; the audit
reports **no known vulnerabilities**. The actual local-action handled-failure
step emitted a valid published-contract cleanup event with status=failure,
mode=dry-run and deletionRequestedCount=0, naming this exact main commit/run.

Processed CodeQL main analysis **2168340046**, created at **18:37:44 UTC**,
records the same commit/ref, **87 rules, zero results, and empty error/warning
fields**. Successful SARIF upload is present in the run log; the open-alert query
scoped to main returned an empty list. CodeQL workflow completion was updated at
18:38:07 UTC; the table records its job completion instead.

**PASS — protection remains enforced:** a fresh read-back after PR #5 confirms
`protected=true`, exactly these required app-bound contexts:

- `validate` from GitHub Actions, app **15368**.
- `CodeQL` from GitHub Advanced Security, app **57789**.

Up-to-date checks (`strict=true`) and administrator enforcement remain enabled;
force pushes and branch deletion remain disabled. No protection settings were
changed during this verification. The required PR context `CodeQL` is distinct
from the workflow's `analyze` job; both the main workflow and processed analysis
were verified above. See [release-readiness.md](release-readiness.md) for the
complete policy and verification commands.

Evidence was read using `gh run list/view` (JSON metadata and logs), commit
`check-runs`, code-scanning analyses/open-alert APIs, and branch/protection GETs.
Independent review reproduced the results. This documentation follow-up changes
only the report; `pnpm format:check`, `pnpm scan:public` and `git diff --check`
verify the update, with normal required PR checks before merge.

**Remaining blockers are unchanged:** authoritative SAP four-hour eligibility
evidence, operational protection review, separately authorized non-production
validation, owner release/consumer approval and fork package-access limitations.
The production eligibility gate remains closed. Hosted sandbox/live webhook and
real SAP validation remain unexecuted as detailed below. This verification
publishes no package, creates no tag, deploys nothing and does not enable or
perform real SAP deletion.

## Published notification-contract adoption and post-merge verification — 2026-11-14

Status vocabulary: PASS, FAIL, BLOCKED, NOT RUN. This report records the current
registry-backed cleanup upgrade. The action remains unreleased. Passing tests
and a source merge do not authorize publication, deployment or SAP deletion.
The [previous report](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/ae42942c18f2ca48f6b4286c31089cf629865796/docs/validation-report.md)
retains the original candidate validation and PR #1 security remediation evidence.

## Source and dependency provenance

- Cleanup upgrade base: `ae42942c18f2ca48f6b4286c31089cf629865796`.
- [Cleanup PR #3](https://github.com/commercekit-tools/ccv2-build-cleanup/pull/3)
  merged at **2026-11-14 18:05:58 UTC** as
  `ce2f9b7722c1bd04955f07d8f3b11ea0f08ab257`; this exact main commit is
  the subject of the post-merge verification below.
- Reviewed PR head: `6a7b47bc892d3cf8a4efa10f82ebb52dfa82e208`;
  consumer examples pin validated implementation commit
  `d7363059d4ef523a40e8df912c03ee1215200224`.
- Published notification-contract **0.0.4**, exact registry dependency;
  ccv2-client remains **0.0.3**, actions/core **3.0.1**.
- Contract publication source: action-kit
  `a03da9366e6483040d504a742c1a95413c1202cb`;
  [package-only run 43622416072](https://github.com/commercekit-tools/action-kit/actions/runs/43622416072).
- Contract registry integrity:
  `sha512-y1kTB/s049V0DGLoQZd4s+vlFscShG5wS5g2H4WH6t6rRSOuJrKiCy42dcNlx5wC7NAy6hQuYoTFOQVQ1+PVoA==`.
- Compatible merged Notify:
  `832f6bd04b1889d0d3b4d47a1b2dc0e110985c73`.
- CI sandbox: merged `4af998a4783ffa54dd5d7835bfc0dcc4dd382e14`.
  Local validation used its equivalent pre-squash head
  `ad7a4be86f60243f9005cea9feb63abbf9dbf01a`, tree
  `73f7db75196fa9e0c503e601a6bf8d4ed3777922`.
- Runtime: Node **24.21.0**, pnpm **12.6.0**, TypeScript **6.0.3**.
- Normal bundle SHA-256:
  `be0faed210885aad0eabacf2525befd32c5fa6b378d4cd9825f35506c214c4b4`.

**PASS:** normal installation, lockfile, tests and standalone bundle use the
published registry dependency. No developer-local links, package aliases,
candidate tarballs or invented versions are required. The cleanup public factory
and shared parser/schema are tested from the actual installed package. Historical
patches/provenance remain archived; executable candidate preparation was removed.

## Final hosted evidence

**PASS:** both post-merge workflows completed successfully for the **push** to
`refs/heads/main` at `ce2f9b7722c1bd04955f07d8f3b11ea0f08ab257`.
These are main-branch results, distinct from the pre-merge PR checks.

| Check                 | Final evidence                                                                                                                                                   | Job/check completion (UTC) |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Pre-merge `validate`  | [Run 43624527452](https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/43624527452), PASS on reviewed PR head                                    | 2026-11-14 18:04:59        |
| Pre-merge CodeQL      | [Run 43624527425](https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/43624527425), PASS on reviewed PR head; separate CodeQL check also passed | 2026-11-14 18:05:17        |
| Post-merge `validate` | [Run 43624684600](https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/43624684600), job `validate` / `132537784174`, PASS on exact merged main  | 2026-11-14 18:06:45        |
| Post-merge CodeQL     | [Run 43624684609](https://github.com/commercekit-tools/ccv2-build-cleanup/actions/runs/43624684609), job `analyze` / `132537784276`, PASS on exact merged main   | 2026-11-14 18:07:13        |

The main validation log independently confirms **300/300 tests in 14/14 files,
zero skipped, and 100% statement/branch/function/line coverage**. Frozen cleanup
installation used Node24.21.0 and pnpm12.6.0; the existing sandbox used its own
pinned pnpm12.11.2. Format, lint, strict types, actual local sandbox E2E,
committed-bundle consistency, metadata/actionlint, public scan and full dependency
audit all passed. The audit reports **no known vulnerabilities**. Trusted-main
package-read access is now proven by the successful frozen registry install.

The final `uses: ./` smoke check intentionally supplies malformed retention
input and synthetic credentials. The expected handled action failure is
continued, then the next successful step asserts cleanup-status=failed,
dry-run=true and zero accepted deletion requests. Its actual notification parses
through the published shared contract with eventType=`ccv2.build-cleanup.completed`,
status=failure, mode=dry-run and deletionRequestedCount=0. Workflow context names
`refs/heads/main`, the exact merged commit and this main run. This is useful
failure-path evidence; it is not a SAP connection or live deletion test.

CodeQL's processed main analysis **2168255995**, created at
**2026-11-14 18:06:52 UTC**, names the exact merged commit and `refs/heads/main`.
The API reports **87 rules, zero results, and empty error/warning fields**.
The open-alert query scoped to main returned an empty list. Successful SARIF
upload is also present in the run log.

Verification used authenticated, read-only GitHub CLI calls with stale token
environment overrides removed (`env -u GITHUB_TOKEN -u GH_TOKEN gh ...`):

- `gh api repos/commercekit-tools/ccv2-build-cleanup/branches/main` and
  `gh run list --repo commercekit-tools/ccv2-build-cleanup --branch main` to
  match the current main SHA with push-triggered runs.
- `gh run view 43624684600` and `gh run view 43624684609`, each with
  `--repo commercekit-tools/ccv2-build-cleanup`, JSON job metadata and `--log`,
  to verify conclusions, timestamps, actual steps and logged results.
- The exact merged commit's `check-runs` API to confirm successful completed
  `validate` and `analyze` checks.
- The `code-scanning/analyses` API scoped to `refs/heads/main` and the
  `code-scanning/alerts` API scoped to main/state=open to verify processing
  and current findings. No credentials or raw logs are committed.

## Executed local checks

The local commands below were run during the implementation upgrade. The prior
evidence-only follow-up rechecked the completed hosted main runs and changed
only this report;
`pnpm format:check`, `pnpm scan:public` and `git diff --check` passed for the
report update. The subsequent branch-protection documentation update also passed
these checks for both readiness and validation docs. No runtime bundle or
production logic changed.

Commands ran in the isolated upgrade checkout with Node24 first on PATH.
`CLEANUP_SANDBOX_PATH` below points to the isolated existing sandbox checkout.

| Command                                                                                         | Status | Evidence                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                | PASS   | Actual registry package and integrity-locked resolution; supply-chain policy checks passed                                 |
| `pnpm bundle`                                                                                   | PASS   | Regenerated standalone runtime bundle and licenses using ncc0.45.0                                                         |
| `CLEANUP_SANDBOX_PATH=<checkout> pnpm quality`                                                  | PASS   | Formatting, lint, strict types, full coverage suite, byte-consistent dist, metadata, public scan and full dependency audit |
| `actionlint .github/workflows/*.yml examples/*.yml`                                             | PASS   | Workflow/action examples validated; third-party immutable pins retained                                                    |
| `CLEANUP_SANDBOX_PATH=<checkout> CLEANUP_SANDBOX_PORT=18819 node scripts/sandbox/local-e2e.mjs` | PASS   | Separate actual-bundle sandbox run with published-contract output validation                                               |
| Focused unit/contract notification suite                                                        | PASS   | 16 cases against actual published package, including redaction and all cleanup outcomes/modes                              |
| `git diff --check`                                                                              | PASS   | No whitespace errors                                                                                                       |
| Hosted `validate` and CodeQL on final PR head                                                   | PASS   | Successful exact-head checks before PR #3 merge; linked above                                                              |
| Post-merge `validate` and CodeQL on main                                                        | PASS   | Independent push runs and processed analysis on the exact merged commit; linked above                                      |

Full suite: **300 tests passed in 14 files; zero skipped**.
Coverage: **100% statements (458/458), branches (441/441), functions (88/88),
lines (410/410)**. Thresholds remain 98% for every metric, with all production
logic included. Two obsolete missing-factory cases were removed together with
that compatibility branch; useful former candidate cases now run in the normal
contract suite. No destructive decision tests or safety logic were removed.

The first full-quality attempt reached the public scan before the removed
candidate files were staged, so Git still enumerated nonexistent files. After
staging those removals, the entire gate reran successfully. An initial bundle
invocation inherited an unavailable system Node; using the declared Node24 runtime
resolved it. Neither issue required weakening checks or changing system software.
Full `pnpm audit` reports **no known vulnerabilities**. The existing exact security
override remains in place; no audit advisory or severity is suppressed.

## Notification and sandbox evidence

**PASS:** every actual bundled sandbox invocation emits a nonempty, bounded
`ccv2.build-cleanup.completed` event. The actual published shared parser validates
schema/version/source, dry-run/apply mode, shared success/failure vocabulary,
cleanup outcome, exact scope, retention settings, all eight shared counts,
duration, occurrence time, safe error code and workflow context against the
cleanup result. Run credentials and control tokens are absent from the output.
Unit/contract tests cover dry-run, no-op, success, blocked, partial failure,
failure and unknown outcomes. Notification/report failures preserve the cleanup
outcome. CI also verifies the local `uses: ./` handled-input-failure event.

**PASS:** actual standalone bundle against isolated existing sandbox runs: OAuth,
401 refresh, safe-read429/500 recovery,105-build multi-page inventory,
combined retention/protections/exclusions, exact empty application scope,
repeat-run safety, invalid flags, pagination instability, authorization failure,
report/summary/output consistency and zero target API mutations for dry-run and
eligibility-blocked apply. Sandbox control/fixture operations are counted
separately; isolated runs are removed in finally blocks.

**PASS:** full existing retention/discovery/execution/reporting suite, including
age/count independence, equality, deterministic ranking, malformed evidence,
protection races, retention-floor changes, immutable cap/no refill, sequential
execution, definitive continuation,204 initiation,404 absence, ambiguous stop,
cancellation/deadlines and partial-result preservation. Shared integration tests
exercise real OAuth/resource/header/cache/refresh/masking and safe-read versus
unsafe-mutation policies. No OAuth/transport implementation or webhook delivery
was introduced. No changes were made to deletion safety, retention, API or input
logic in this upgrade.

**BLOCKED:** real SAP apply and successful/ambiguous/capped destructive E2E through
the production adapter. `eligibilityVerified=false` remains unchanged because
supported production evidence for four-hour last-modification eligibility is
unresolved. Destructive orchestration is tested with injected verified evidence;
sandbox eligibility metadata is not production SAP proof. There is no bypass.

**NOT RUN:** hosted sandbox smoke, live provider webhook delivery, real SAP
read/dry-run validation or DELETE. Dedicated sandbox process-cancellation and
network-timeout E2E fixtures are not claimed; bounded cancellation/deadline and
network ambiguity remain covered in orchestration/shared integration tests.

## Remaining blockers and unexecuted validation

The published-contract compatibility gate, trusted-main package access and
pre-/post-merge hosted validation are **PASS**. PR #3 is merged. An unreleased
source merge does not clear the remaining release or destructive-operation gates:

- **BLOCKED — SAP eligibility evidence:** supported last-modification evidence
  or authoritative API rejection of ineligible deletes before acceptance is
  still missing. Completion time and simulator internals do not prove the
  four-hour condition. The production adapter's `eligibilityVerified=false`
  gate remains closed, without a bypass.
- **BLOCKED — operational protection review:** owners must validate supported
  deployment/green/canary/rollback and snapshot/backup reference coverage for
  the target subscription. Incomplete protection evidence or unstable/incomplete
  inventory block apply. Pagination remains non-atomic and preflight cannot
  remove the check/delete race.
- **BLOCKED — owner approval and controlled non-production validation:** real
  SAP read-only/dry-run verification, candidate/protection review and a bounded
  destructive test of one explicitly approved disposable build require the
  separate authorizations described in the
  [release-readiness runbook](release-readiness.md). None was performed here.
- **PASS — required branch checks configured:** on 2026-11-14, main protection
  was applied and read back with `protected=true`, up-to-date `validate` and
  `CodeQL` requirements bound to GitHub Actions (15368) and GitHub Advanced
  Security (57789), administrator enforcement enabled, and force pushes/deletion
  disabled. See [release-readiness.md](release-readiness.md) for exact settings
  and verification commands. This resolves the previously recorded missing
  branch-protection gate.
- **BLOCKED — owner governance/setup before release:** ownership, release review
  and consumer configuration still require owner approval. Fork/package-access
  limitations remain, despite trusted-main access passing. Never expose
  privileged credentials through `pull_request_target`.
- **NOT RUN:** hosted sandbox smoke, live provider webhook delivery and all real
  SAP validation/deletion. Dedicated process-cancellation and network-timeout
  sandbox E2E fixtures remain unexecuted as noted above. Existing unit/integration
  coverage does not turn those into completed live tests.

Consumers need no package credentials because runtime dependencies are bundled.
Sandbox and static-analysis success are not production SAP safety guarantees.

This upgrade creates no release tags, deployment, production enablement or real
SAP deletion. Previously authorized dependency publication is recorded only as
provenance; this task publishes no package.
