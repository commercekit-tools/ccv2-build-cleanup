# Validation report

Initial implementation, unreleased. Status vocabulary: PASS, FAIL, BLOCKED,
NOT RUN. Passing validation is not release or destructive-operation approval.
Exact audited repository SHAs and registry integrities are in
[integration-audit.md](integration-audit.md). Candidate patch digests/package
integrity are in [candidate-provenance.json](../integration/candidate-provenance.json).

## Dependencies and provenance

**PASS:** Node 24.21.0, pnpm 12.6.0, strict TypeScript 6.0.3; registry-installed
ccv2-client **0.0.3**, notification-contract **0.0.3**, actions/core **3.0.1**.
`npm view <package>@0.0.3 version dist.integrity --registry=https://npm.pkg.github.com`
verified both published packages; `pnpm install --frozen-lockfile` completed with
supply-chain checks. The initial restricted-network pnpm verification failed
DNS and was rerun with network access. No credentials were printed or committed.

**BLOCKED:** the normal registry contract has no cleanup event. The normal bundle
emits an empty event and explicit warning. The additive contract/Notify changes
are tested from an exact-source packed tarball in isolated workspaces. No normal
lockfile contains candidate source, machine links or a fake registry version.

## Executed cleanup checks

| Command                                                                                                    | Status  | Evidence                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                                                                           | PASS    | Registry integrity lockfile; authorized package-read installation                                                                          |
| `node node_modules/prettier/bin/prettier.cjs --check .`                                                    | PASS    | All source/docs/workflows formatted                                                                                                        |
| `node node_modules/eslint/bin/eslint.js .`                                                                 | PASS    | Includes production code, tests and integration scripts                                                                                    |
| `node node_modules/typescript/bin/tsc --noEmit`                                                            | PASS    | Strict types, public shared imports                                                                                                        |
| `node integration/prepare-candidate.mjs` with audited source path                                          | PASS    | Clean base verified, focused patch applied in temp copy; frozen install/build/typecheck; 277 upstream tests; npm pack and isolated install |
| `node node_modules/vitest/vitest.mjs run --coverage` with candidate package and local sandbox paths        | PASS    | Final totals/coverage below; no production-code coverage exclusions; thresholds 98% all metrics                                            |
| `node node_modules/@vercel/ncc/dist/ncc/cli.js build src/index.ts --minify --license licenses.txt -o dist` | PASS    | Standalone Node24 ESM bundle, runtime dependencies/licenses included                                                                       |
| `node scripts/check-bundle.mjs`                                                                            | PASS    | Fresh ncc output byte-compared with all committed dist files                                                                               |
| `node scripts/check-metadata.mjs`                                                                          | PASS    | Action metadata/output/workflow policy validation                                                                                          |
| `actionlint .github/workflows/*.yml examples/*.yml`                                                        | PASS    | actionlint1.7.12 incl shellcheck; official Linux binary SHA256 pinned in CI                                                                |
| `node scripts/scan-public-files.mjs`                                                                       | PASS    | No configured public-safety secret/path patterns found                                                                                     |
| `pnpm audit --prod --audit-level=high`                                                                     | PASS    | No known production dependency vulnerabilities                                                                                             |
| GitHub hosted `validate` / CodeQL                                                                          | NOT RUN | Local task did not push or trigger remote checks                                                                                           |

Final full cleanup suite: **301 tests passed, 14 files passed, zero skipped.**
Coverage: **100% statements, 100% branches, 100% functions, 100% lines**
(462 statements, 447 branches, 88 functions, 415 lines). The run included the
actual normal bundle/local sandbox E2E wrapper. An additional separate candidate
bundle local sandbox run also passed with actual event validation.
Normal bundle SHA-256: `dd19eb9a0fd22bf45e0c863deefff6a3bbcd684d866f1e53dfbce6b8a1ee23f1`.
The standard published-only suite passes but cannot cover absent notification
factory branches; full coverage intentionally requires the real candidate test
project until a compatible package is published. No coverage threshold was
lowered and no production file or destructive logic was excluded.

## Behavioral and sandbox evidence

**PASS:** retention age/count independence and combined AND rule; UTC/equality,
start-vs-completion ranking, deterministic ties, malformed timestamps, exact
application, exclusions, small/empty inventories; deterministic generated
monotonic properties for keep-latest, age and exclusions.

**PASS:** required protection categories, absent flags, unknown states, invalid
operational/cancellation evidence, current versus historical deployment refs,
previous-build mapping, snapshot and backup protection; complete discovery,
count/duplicate/drift/page/item/request bounds; final recheck races/floor changes;
sequential immutable cap/no refill; definitive continuation, 204 initiation,
404 absence, ambiguous stop, auth failures, deadline/cancellation and partial
result preservation. Destructive orchestration is tested with injected verified
evidence; production code exposes no eligibility-bypass input.

**PASS:** actual published shared packages verify form/resource mapping,
x-approuter authentication header, cache/expiry, masking, bounded401 refresh,
safe-read429/5xx retry and unsafe-mutation no retry/replay. Reporting checks
counts/dispositions, bounded/truncated inline JSON, private report writes,
malicious markup, secret redaction, safe GitHub Enterprise links, status outcomes
and preservation after reporting/notification failure. The exact consumer mode
script is executed for enablement case/malformed/missing-input truth-table cases;
GitHub's case-insensitive expression equality cannot enable deletion here.

**PASS:** actual normal bundle against the existing local sandbox with isolated
runs: OAuth,401refresh,429/500 read recovery,105-build multi-page double inventory,
mixed successful/failed/active/unknown/deletion-marked/protected builds,
exclusions, age/count, exact empty application scope, repeat-run, invalid flags,
pagination instability,403stop, outputs/report/summary and zero target mutations
for dry-run and eligibility-blocked apply. Run fixture/control operations are
counted separately from target API mutations. Every run is removed in finally.

**PASS:** separate cleanup source bundle against the exact packed notification
candidate, with actual event parsing/validation and mode/status/count checks
against that candidate package for every sandbox action execution. The normal
registry bundle is not replaced by this candidate bundle.

**PASS:** focused sandbox fixtures/model tests cover initiation without physical
removal, recent internal modification, deployment/snapshot races, disappearance,
accepted-then-ambiguous response, permission/isolation and malformed fixtures.
The fixture metadata does not establish a SAP API last-modified field or guarantee.

**BLOCKED:** successful/ambiguous/capped destructive orchestration through the
actual production-adapter bundle, because eligibilityVerified=false intentionally
prevents every DELETE. Algorithm branches are tested separately, and simulator
DELETE behavior is tested in the sandbox candidate. There is no hidden bypass.

**NOT RUN:** hosted sandbox smoke; real SAP read/dry-run validation; real SAP
DELETE; live provider webhook delivery. Dedicated sandbox network-timeout and
process-cancellation/deadline end-to-end fixtures were not claimed; cancellation,
deadline and network ambiguity are tested in cleanup/shared-client tests.

## Upstream compatibility and security

**PASS:** candidate action-kit277 tests and full typecheck; candidate Notify88
tests, typecheck and bundle, including old-event regression coverage and both
existing providers' cleanup presentation. Existing upstream thresholds were not
changed. Upstream coverage details are recorded in candidate provenance.
Sandbox final source base, candidate commit and regressions are documented in
sandbox-testing.md. No original shared/consumer/sandbox working tree was edited.

Official checkout/setup-node/CodeQL commit SHAs were verified through public
GitHub API. An initial authenticated gh metadata attempt returned401; public
read-only API verification succeeded. No replacement credential was requested.
No OAuth/cache/transport/retry implementation or webhook/provider delivery was
copied or duplicated. No new shared package or Cloudflare configuration change.

**BLOCKED release:** SAP four-hour API enforcement/eligibility evidence,
operational safety review and separately authorized non-production validation;
publication/pinning of the minimal compatible notification contract and Notify
commit; repository package/source access and owner-required CI/release approvals.
See [release-readiness.md](release-readiness.md) for the future controlled runbook.

No release, publication, merge, version/moving tag, production enablement or real
SAP deletion occurred. All cleanup execution was local simulation.

## Subsequent draft-review preparation

The owner subsequently authorized pushing feature branches and opening draft
PRs. See [pr-handoff.md](pr-handoff.md) for current heads, rebased bases and
additional Notify schema/fixture validation. The results above remain the
recorded local implementation validation; they do not claim remote CI status.

## PR #1 security-check remediation — 2026-11-14

The first hosted run found a full-dependency audit failure and two CodeQL
incomplete-escaping findings. These were separate from the earlier, narrower
production-only audit result.

- Pin vulnerable development-tool `minimatch` instances to published **11.0.1**
  using an exact pnpm override for the advisory range. The regenerated lockfile
  records its integrity and dependencies. This follows
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249);
  Node 24 satisfies the patched release's engine range. No advisory is ignored
  and no audit severity/dependency scope is weakened. The package audit script
  now explicitly runs the same full audit used by CI.
- Replace the URL-escaping callback's partial replacement chain with a direct
  parenthesis-to-percent-encoding mapping inside the existing global match.
  Regression coverage checks repeated/nested parentheses and preserves already
  encoded URL content. The shared HTTPS link validator is still used.
- **PASS:** frozen installation; full `pnpm audit` (no known vulnerabilities);
  formatting, lint, strict types; **302 tests in 14 files with zero skips and
  100% statement/branch/function/line coverage** (462 statements, 449 branches,
  88 functions, 415 lines), including actual normal-bundle local sandbox E2E.
  Fresh dist byte-consistency, metadata/actionlint and public scan passed.
- Hosted validate/CodeQL must rerun on the pushed fix before readiness is claimed.
  SAP eligibility, notification publication and all live-operation gates remain
  unchanged. The four implementation PRs stay draft.
