# Cleanup notification context

**Compatible Notify: PASS.** [PR #18](https://github.com/commercekit-tools/notify/pull/18)
merged as `6331ff4a60956a3a2b546e84d737c9338ca46bda` after normal registry-backed
quality and CodeQL passed. [CI run 43668192744](https://github.com/commercekit-tools/notify/actions/runs/43668192744)
passed 107 tests in 12 files, 19 schema fixtures and six standalone provider
cases. [CodeQL run 43668192753](https://github.com/commercekit-tools/notify/actions/runs/43668192753)
and the processed PR security check passed. Both providers show the complete
redacted input context, counts, failure explanations and warning issues.

This change leaves all 14 cleanup inputs, retention, discovery, deletion and
Action failure behavior intact. It extends only the existing notification
contract and cleanup reporting/Notify rendering. No date-range/status selector
was added.

## Message behavior

All new Cleanup Action notifications include the 14 input names. Valid
configuration uses effective defaults and normalized values. Invalid
configuration shows safely sanitized supplied settings and
`inputsValidated=false`, with an explanation of what is invalid and that cleanup
did not start. Four authentication fields are always literal `[REDACTED]`:
token-endpoint, client-id, client-secret and resource. Received tokens are still
registered with the existing secret masker.

Other values use shared known-secret/JWT redaction. Valid public HTTPS API
origins remain visible; arbitrary/credential-bearing URLs use the shared error
filter. Each public input value is bounded to 256 characters, with a visible
truncation suffix and `inputsTruncated=true` when needed. Redaction precedes
truncation. No raw credential object, OAuth response or authentication header is
included.

| Status  | Meaning and displayed detail                                                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| success | Successful apply/no-op/clean dry-run; all counts and settings. Accepted HTTP 204 deletion requests are shown explicitly. Dry-run never calls hypothetical deletion completed.                         |
| warning | Safety-blocked dry-run with verified complete inventory, no actual error/failed/unknown targets and no accepted mutation. Safe issue messages explain eligibility/protection blockers.                |
| failure | Actual errors, partial failures, unknown outcomes, authentication/authorization errors, incomplete inventory or blocked apply. A safe code/message and available HTTP status explain what went wrong. |

An HTTP 204 means deletion was initiated, not that physical removal completed.
The existing action outcome and `cleanup-status` remain independent of the
shared notification status. A warning cannot downgrade a destructive failure or
make an apply block successful. Unknown outcomes still stop further requests.

Both Slack and Teams show scanned, eligible, planned, accepted, skipped,
protected, blocked, deferred, failed and unknown counts; effective inputs;
failure detail or warning issues; scope, duration and workflow references.
Cleanup-only detail sections replace the old nine-fact truncation while
preserving non-cleanup presentation snapshots and existing delivery. Older
cleanup events without the new optional context still render with explicit
unavailable values.

## Published shared contract and consumer validation

Only the existing notification-contract package changes. BuildCleanupStatus
adds warning for cleanup only; CompletedStatus and Build/Deploy semantics are
unchanged. Optional input context, validation/truncation flags, protected/blocked
counts and at most three safe issue entries extend the existing event. The
schema requires all 14 snapshot keys, bounds public values and rejects raw
authentication values. Existing factories/validation, safe context, text and link
primitives remain in use.

- Published package: `@commercekit-tools/notification-contract@0.0.5`.
- Authorized [package-only publication run 43667757934](https://github.com/commercekit-tools/action-kit/actions/runs/43667757934): **PASS**.
- Publication source: action-kit main
  `7cc2e8e6af46e7438064cc6205b22f4f7154eb94`, following PR #12.
- Registry integrity:
  `sha512-SMcyyWaeHdtlztt99xtWlJycSAspSTGvCaWJH7M2+u+on77JHwo8boTBOc9UUC0BQHDPo/VHmOj4gpt/XIbqmw==`.
- The published integrity exactly matches the source-packed artifact tested
  before publication. Its SHA256 is
  `9c3b9910dc51be697c3aa4e44620c3cd87d3cdd132f9a5431e85f9cb5f712dec`.
- ccv2-client remains exact published **0.0.3**. Normal cleanup manifest and
  lockfile now use registry **0.0.5**; no `file:` link or source alias is used.

Executed registry transition evidence:

| Validation                                                | Result                                                                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry 0.0.5 availability/integrity                     | PASS: published artifact verified; integrity matches the tested source artifact                                                                     |
| Cleanup normal frozen installation/public exports         | PASS: `pnpm install --frozen-lockfile`; required public exports verified                                                                            |
| Cleanup normal bundle regeneration                        | PASS: `pnpm bundle`; SHA256 `6b11122ba8223b8d26525a443336bfec352952c43d949b4f7ad347cf857fb8ee`, identical to the previously tested candidate bundle |
| Cleanup lint and strict types                             | PASS: `pnpm lint`, `pnpm typecheck`                                                                                                                 |
| Cleanup coverage and actual bundled local Sandbox         | PASS: 372 tests/16 files, zero skipped; 99.81% statements, 99.62% branches, 100% functions/lines; thresholds remain 98%                             |
| Action/workflow lint                                      | PASS: local actionlint                                                                                                                              |
| Bundle consistency, metadata, public scan and audit       | PASS: `pnpm bundle:check`, `pnpm metadata:check`, `pnpm scan:public` (70 files), `pnpm audit` (no known vulnerabilities), `git diff --check`        |
| Final repository formatting and required hosted PR checks | PASS: format; validate 43668394766 and CodeQL 43668394744 on the immutable implementation pinned by examples                                        |
| Notify full registry-backed quality/required PR checks    | PASS: 107 tests, 19 fixtures, six standalone provider/status cases; quality/CodeQL green; #18 merged                                                |
| Real SAP, hosted Sandbox dispatch, live Slack/Teams sends | NOT RUN in this task                                                                                                                                |

Normal registry-backed checks passed on cleanup implementation
`ac5cbcc2fdf1054a891a7a00e1527299b4627130`. All consumer examples now pin that
validated immutable implementation and the notification example pins the merged
0.0.5-compatible Notify above. [Validation evidence](validation-report.md) links
the exact runs. Documentation/example follow-ups must pass the same required
checks before merge. Older Notify versions may reject cleanup warning events.

## Historical source-packed validation

Before publication, exact-source packed packages were tested in isolated private
consumer workspaces. These completed results are historical evidence, separate
from the registry-backed consumer checks above:

- Contract candidate source: `3f9e418556b190bb8d55ac11a22f554e2c51a4a5`.
- Tarball: `commercekit-tools-notification-contract-0.0.5.tgz`, 13836 bytes,
  with the SHA256/integrity recorded above.
- Notify candidate source: `d045178cd638fddc96c8b2c3d5b8c8ef7b4edc7f`.
- Consumer manifests/locks at that stage intentionally remained on published
  0.0.4; only isolated temporary consumers installed the reviewed tarball.

| Historical validation                                              | Result                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Action-kit full quality/packed ESM/schema/declaration/export/audit | PASS: 312 tests; notification contract 100% statements/functions/lines, 99.3% branches                                     |
| Cleanup full candidate coverage and actual bundled local Sandbox   | PASS: 372 tests/16 files, zero skipped; 99.81% statements, 99.62% branches, 100% functions/lines; thresholds 98% unchanged |
| Notify full candidate quality                                      | PASS: 107 tests/12 files, 19 schema fixtures, zero skipped; existing thresholds unchanged                                  |
| Actual standalone candidate Notify bundle                          | PASS: 6 provider × success/failure/warning cases; all 14 input names, safe errors/issues and redaction                     |

Cleanup tests cover invalid/valid settings, complete input parity/redaction,
accepted-request counts, HTTP/validation errors, prototype-key safety, all
warning/failure boundaries, truncation and preservation if reporting fails. The
actual candidate bundle local Sandbox run validated all input contexts, warning
issues, counts and zero target mutations across multi-page discovery/failure
cases. No production coverage files were excluded or thresholds reduced.

The original reproduction procedure and exact-hash checking script are archived
at immutable cleanup commit
[`fb566f6d2268f663a0ea8e0f43890ea5eb818e33`](https://github.com/commercekit-tools/ccv2-build-cleanup/tree/fb566f6d2268f663a0ea8e0f43890ea5eb818e33)
([instructions](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/fb566f6d2268f663a0ea8e0f43890ea5eb818e33/docs/notification-context.md),
[script](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/fb566f6d2268f663a0ea8e0f43890ea5eb818e33/integration/validate-notification-candidate.mjs)).
The script was retired from the current build path after publication. Normal
development uses Node 24.21.0/pnpm 12.6.0, a frozen registry install, the normal
test suite and the pinned local Sandbox; no action-kit source checkout or
candidate package preparation is needed.

## Remaining gates

The owner authorized the package publication and consumer merges only when all
required checks are green. Registry compatibility and implementation checks passed;
final PR heads must independently satisfy branch protection. Publication does not
create an Action release or authorize Git tags, deployment or real deletion.
Inputs, default dry-run, the unverified SAP four-hour eligibility gate and all
operational protection checks remain unchanged. No real SAP or live provider
operation was performed.
