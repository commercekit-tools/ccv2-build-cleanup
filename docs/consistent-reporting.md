# Consistent cleanup reporting candidate

This focused change projects cleanup results into the shared
`renderActionSummary` public API from the existing notification-contract package.
The shared renderer owns status labels/icons, safe Markdown tables, known-secret
and JWT redaction, defensive confidential-name masking, safe links and byte/row
bounds. This repository does not implement a second formatting toolkit.

The summary shows a prominent DRY RUN or APPLY mode, the original cleanup status,
all ten aggregate counts, subscription/application scope, retention/cap settings,
duration, a named safety-evidence table, at most 50 build decisions, all fourteen
input names and validation/truncation metadata. A bounded table explains safe
errors and warning issues. Success counts accepted deletion requests; physical
removal is never claimed. Detailed sanitized results remain at report-path.

Summary severity comes from the same `describeCleanupOutcome` projection used by
notifications: clean dry-run/no-op/apply is success; verified-inventory safely
blocked dry-run is warning; errors, incomplete inventory, unknown/partial outcomes
and blocked apply remain failure. Formatting changes do not alter Action failure
behavior or authorize deletion. A summary-write failure still preserves outputs
and the original cleanup outcome.

## Compatibility gate

The helper is new in the unpublished notification-contract 0.0.6 source
candidate. Normal package.json, pnpm-lock.yaml, pnpm-workspace.yaml and dist stay
on published 0.0.5, which does not export it. Normal registry type checking and
bundle consistency are therefore BLOCKED for this source until separately
authorized publication, exact consumer repinning and normal bundle regeneration.
No package is published or fake registry dependency committed by this change.

Candidate validation must use an exact-source packed tarball in a separate
private temporary consumer workspace. Record the contract source SHA, tarball
SHA256/integrity and bundle hash together with actual commands/results. Keep
those candidate results separate from registry/release readiness. The existing
0.0.5 cleanup event schema, fourteen input names/defaults, retention, discovery,
delete orchestration and production eligibility gate are unchanged.

## Validation status

- PASS: unchanged published 0.0.5 frozen dependency installation; focused
  formatting, lint and diff checks.
- PASS: WIP exact-source 0.0.6 packed candidate bundle, strict typing and full
  `pnpm quality` in a separate private consumer. All **386 tests in 17 files**
  passed with zero skips, including the actual bundled local Sandbox. Coverage
  was **99.81% statements, 99.62% branches, 100% functions and lines**; the
  existing 98% thresholds and production-file inclusion remain unchanged.
- PASS: candidate bundle byte consistency, metadata, public scan (72 files) and
  full dependency audit (no known vulnerabilities).
- PASS: final reviewed source tarball replay from shared contract commit
  `b88ed58976af9aee532488d82ea09340b35a4d8c`; fresh private consumer, frozen
  file:tarball install, bundle regeneration and full quality/local Sandbox
  repeated successfully. Final provenance is recorded below.
- BLOCKED: normal registry rebuild and release readiness pending separate
  publication authorization and verified consumer adoption.
- NOT RUN: hosted Sandbox dispatch, live notification-provider sends, real SAP
  read-only or destructive validation. No tags, releases or deployment.

Focused tests cover semantic success/failure/warning, all counts, safe
error/issue explanations, input parity, malicious/forged confidential values,
links, decision truncation and size bounds. Existing tests continue to verify
summary-write failure preservation. Local Sandbox assertions additionally check
status icons, all input names and counts, issue codes and secret non-disclosure.

## WIP candidate provenance

The provisional tarball was prepared from the shared package source under review,
not published or represented as a registry dependency. Its exact bytes were used
only in the private candidate consumer; normal repository files were untouched.

- Tarball SHA256:
  `eb70f8d1ee3d309df1522a50d38921192c13eb8324be5e78866cc2f3063aa16d`.
- Integrity:
  `sha512-281Eei0/RZ4BK3P2lsnYDSj+G/eQN4uzxEUW5XYQldNGcNwnpLoyNtjDxcn3rM/NfIN7Uoi8Pggi60AFhYJ+bA==`.
- Candidate cleanup bundle SHA256:
  `318e55a3aa439657d75506f262a1a3a39dedfe13ff1492dcfe4241841eaed577`.
- Local Sandbox checkout: `ad7a4be86f60243f9005cea9feb63abbf9dbf01a`,
  tree `73f7db75196fa9e0c503e601a6bf8d4ed3777922`; this is the previously
  verified content tree of the pinned merged cleanup fixture source.

Commands actually executed in the private candidate consumer used Node 24.21.0
and pnpm 12.6.0:

```sh
pnpm install --no-frozen-lockfile # exact file:tarball in private workspace only
pnpm bundle
pnpm typecheck
CLEANUP_SANDBOX_PATH=<reviewed local checkout> CLEANUP_SANDBOX_PORT=18887 pnpm test:coverage
CLEANUP_SANDBOX_PATH=<reviewed local checkout> CLEANUP_SANDBOX_PORT=18887 pnpm quality
```

The local runtime created isolated synthetic runs, asserted **zero target API
mutations**, and removed its fixture runs in finally blocks. Passing these
checks establishes neither production SAP eligibility nor authorization to
publish, release, deploy or delete.

## Final reviewed candidate replay

The final reviewed source artifact includes shared truncation and safe-link
hardening after the provisional run. It was replayed in a fresh private consumer
without changing normal repository dependency or bundle files.

- Contract source: `b88ed58976af9aee532488d82ea09340b35a4d8c`.
- Tarball SHA256:
  `645b38e7456e63b96e7630da7d63c1f6ccbf27854b5b7001ff77db435afa2393`.
- Integrity:
  `sha512-eqV2tVnjmuYtG5ExjqScPCGxxR8MW8QlbeuXMA/YjzKzujgSMf9oMQpvQDqmysGhHLN8918XtNh9gbO7UQH4Ug==`.
- Final candidate cleanup bundle SHA256:
  `c6214b521678467b42a2aef0d8ea46eb957d725f5aa9955e1ef1c8207ab494f7`.

Commands executed: `pnpm install --no-frozen-lockfile`,
`pnpm install --frozen-lockfile`, `pnpm bundle`, and the complete `pnpm quality`
with the reviewed local Sandbox and port 18887. All **386 tests in 17 files**
passed with zero skips; coverage remained **99.81% statements, 99.62% branches,
100% functions and lines**. Bundle byte consistency, metadata, public scan
(72 files) and the full audit passed with no known vulnerabilities. Local
Sandbox input/status/count/issue checks and secret assertions passed with zero
target mutations.

This is exact-source candidate integration evidence. Normal registry rebuild,
publication and release readiness remain blocked pending separate authorization
and a verified published dependency. No hosted dispatch, provider send, Git tag,
release, deployment or real SAP operation was performed.
