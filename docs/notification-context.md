# Cleanup notification context candidate

This change leaves all 14cleanup inputs, retention, discovery, deletion and Action
failure behavior intact. It extends only the existing notification contract and
cleanup reporting/Notify rendering. No date-range/status selector was added.

## Message behavior

All new Cleanup Action notifications include the 14input names. Valid configuration
uses effective defaults and normalized values. Invalid configuration shows safely
sanitized supplied settings and `inputsValidated=false`, with an explanation of
what is invalid and that cleanup did not start. Four authentication fields are
always literal `[REDACTED]`: token-endpoint, client-id, client-secret and resource.
Received tokens are still registered with the existing secret masker.

Other values use shared known-secret/JWT redaction. Valid public HTTPS API origins
remain visible; arbitrary/credential-bearing URLs use the shared error filter.
Each public input value is bounded to 256 characters, with a visible truncation
suffix and `inputsTruncated=true` when needed. Redaction precedes truncation.
No raw credential object, OAuth response or authentication header is included.

| Status  | Meaning and displayed detail                                                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| success | Successful apply/no-op/clean dry-run; all counts and settings. Accepted HTTP 204 deletion requests are shown explicitly. Dry-run never calls hypothetical deletion completed.                         |
| warning | Safety-blocked dry-run with verified complete inventory, no actual error/failed/unknown targets and no accepted mutation. Safe issue messages explain eligibility/protection blockers.                |
| failure | Actual errors, partial failures, unknown outcomes, authentication/authorization errors, incomplete inventory or blocked apply. A safe code/message and available HTTP status explain what went wrong. |

An HTTP 204 means deletion was initiated, not that physical removal completed.
The existing action outcome and `cleanup-status` remain independent of the shared
notification status. A warning cannot downgrade a destructive failure or make an
apply block successful. Unknown outcomes still stop further requests.

Both Slack and Teams show scanned, eligible, planned, accepted, skipped, protected,
blocked, deferred, failed and unknown counts; effective inputs; failure detail or
warning issues; scope, duration and workflow references. Cleanup-only detail
sections replace the old nine-fact truncation while preserving non-cleanup
presentation snapshots and existing delivery. Older cleanup events without the
new optional context still render with explicit unavailable values.

## Shared contract and provenance

Only the existing notification-contract package changes. BuildCleanupStatus adds
warning for cleanup only; CompletedStatus and Build/Deploy semantics are unchanged.
Optional input context, validation/truncation flags, protected/blocked counts and
at most three safe issue entries extend the existing event. The schema requires
all 14snapshot keys, bounds public values and rejects raw authentication values.
Existing factories/validation, safe context, text and link primitives remain in use.

- Contract source: `3f9e418556b190bb8d55ac11a22f554e2c51a4a5`.
- Honest unpublished source version: **0.0.5**; registry versions remain through 0.0.4.
- Tested tarball: `commercekit-tools-notification-contract-0.0.5.tgz`, 13836 bytes.
- SHA256: `9c3b9910dc51be697c3aa4e44620c3cd87d3cdd132f9a5431e85f9cb5f712dec`.
- Integrity: `sha512-SMcyyWaeHdtlztt99xtWlJycSAspSTGvCaWJH7M2+u+on77JHwo8boTBOc9UUC0BQHDPo/VHmOj4gpt/XIbqmw==`.
- Notify source: `d045178cd638fddc96c8b2c3d5b8c8ef7b4edc7f`.
- Consumer baseline versions remain ccv2-client 0.0.3 and contract 0.0.4.

## Reproducible isolated validation

Use Node 24.21.0/pnpm 12.6.0. In an action-kit checkout at the exact source commit:

```sh
pnpm install --frozen-lockfile
pnpm pack:check notification-contract \
  --output-directory /private/tmp/notification-contract-0.0.5-candidate
```

Then, from this cleanup feature checkout, provide the reviewed Notify checkout
and existing local Sandbox path:

```sh
export CANDIDATE_CONTRACT_TARBALL=/private/tmp/notification-contract-0.0.5-candidate/commercekit-tools-notification-contract-0.0.5.tgz
export NOTIFY_SOURCE_PATH=/path/to/reviewed-notify-checkout
export CLEANUP_SANDBOX_PATH=/path/to/reviewed-local-sandbox
node integration/validate-notification-candidate.mjs
```

The script verifies the exact tarball hashes/version, makes isolated consumers,
changes only their temporary private manifests/locks to a file:tarball dependency,
bundles each and runs full quality gates with explicit candidate metadata checks.
It writes source commit/dirty state, bundle hashes and artifact integrity into a
private validation.json. Normal repository manifests, lockfiles and dist are not
modified. Public schema/export imports remain package-root imports.

Executed evidence:

| Validation                                                         | Result                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Action-kit full quality/packed ESM/schema/declaration/export/audit | PASS: 312 tests; notification contract 100% statements/functions/lines, 99.3% branches                                     |
| Cleanup full candidate coverage and actual bundled local Sandbox   | PASS: 372 tests/16 files, zero skipped; 99.81% statements, 99.62% branches, 100% functions/lines; thresholds 98% unchanged |
| Notify full candidate quality                                      | PASS: 107 tests/12 files, 19 schema fixtures, zero skipped; existing thresholds unchanged                                  |
| Actual standalone candidate Notify bundle                          | PASS: 6 provider×success/failure/warning cases; all 14input names, safe errors/issues and redaction                        |
| Normal registry dependency/bundle readiness                        | BLOCKED: 0.0.5 not published; normal 0.0.4 files remain unchanged                                                          |
| Real SAP, hosted Sandbox dispatch, live Slack/Teams sends          | NOT RUN in this task                                                                                                       |

Cleanup tests cover invalid/valid settings, complete input parity/redaction,
accepted-request counts, HTTP/validation errors, prototype-key safety, all warning/
failure boundaries, truncation and preservation if reporting fails. The actual
candidate bundle local Sandbox run validates all input contexts, warning issues,
counts and zero target mutations across multi-page discovery/failure cases.
No production coverage files were excluded or thresholds reduced.

## Rollout gate

These are coordinated draft source changes, not published/released features.
Normal 0.0.4 validation cannot support cleanup warnings or produce all new fields.
After separate authorization to publish 0.0.5, verify registry integrity, pin exact
versions in both consumers, rebuild/recheck committed bundles and upgrade the
integration harness event assertions/pins. Older consumers may reject the new
cleanup warning status. Do not silently fall back to misleading success/failure.

No contract was published, no tags or releases were created, and no real SAP or
provider operation was performed. Inputs and all production deletion gates remain.
