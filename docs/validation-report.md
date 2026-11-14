# Validation report

## Published notification-contract adoption — 2026-11-14

Status vocabulary: PASS, FAIL, BLOCKED, NOT RUN. This report records the current
registry-backed cleanup upgrade. The action remains unreleased. Passing tests
and a source merge do not authorize publication, deployment or SAP deletion.
The [previous report](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/ae42942c18f2ca48f6b4286c31089cf629865796/docs/validation-report.md)
retains the original candidate validation and PR #1 security remediation evidence.

## Source and dependency provenance

- Cleanup upgrade base: `ae42942c18f2ca48f6b4286c31089cf629865796`.
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

## Executed checks

Commands ran in the isolated upgrade checkout with Node24 first on PATH.
`CLEANUP_SANDBOX_PATH` below points to the isolated existing sandbox checkout.

| Command                                                                                         | Status                      | Evidence                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                | PASS                        | Actual registry package and integrity-locked resolution; supply-chain policy checks passed                                 |
| `pnpm bundle`                                                                                   | PASS                        | Regenerated standalone runtime bundle and licenses using ncc0.45.0                                                         |
| `CLEANUP_SANDBOX_PATH=<checkout> pnpm quality`                                                  | PASS                        | Formatting, lint, strict types, full coverage suite, byte-consistent dist, metadata, public scan and full dependency audit |
| `actionlint .github/workflows/*.yml examples/*.yml`                                             | PASS                        | Workflow/action examples validated; third-party immutable pins retained                                                    |
| `CLEANUP_SANDBOX_PATH=<checkout> CLEANUP_SANDBOX_PORT=18819 node scripts/sandbox/local-e2e.mjs` | PASS                        | Separate actual-bundle sandbox run with published-contract output validation                                               |
| Focused unit/contract notification suite                                                        | PASS                        | 16 cases against actual published package, including redaction and all cleanup outcomes/modes                              |
| `git diff --check`                                                                              | PASS                        | No whitespace errors                                                                                                       |
| Hosted `validate` and CodeQL on final PR head                                                   | NOT RUN at report recording | Must both pass before merge; final PR checks record authoritative hosted results                                           |

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

## Remaining gates and permitted merge

The published-contract compatibility blocker is resolved. Required hosted checks
must be green on the exact final PR head before the separately authorized source
merge. The final PR links its check runs and reviewed immutable source commit.

**BLOCKED for Action release or real apply:** authoritative SAP eligibility and
operational-reference evidence, owner review, package access for development CI,
and separately authorized controlled non-production validation. The full runbook
is in [release-readiness.md](release-readiness.md). Fork credentials must not be
exposed through privileged workflows. Consumers need no package credentials
because runtime dependencies are bundled.

This upgrade creates no release tags, deployment, production enablement or real
SAP deletion. Previously authorized dependency publication is recorded only as
provenance; this task publishes no package.
