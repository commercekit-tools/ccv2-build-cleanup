# Consistent cleanup reporting

Cleanup consumes exact published `@commercekit-tools/notification-contract@0.0.6`
for shared status styling and `renderActionSummary`. The normal GitHub Packages
lockfile and standalone `dist/index.js` are generated from the registry dependency;
no packed-source alias or developer-local link is needed. OAuth, transport and
token lifecycle remain in ccv2-client **0.0.3**, and provider delivery remains in
Notify.

The summary shows DRY RUN/APPLY, the original cleanup status, all ten aggregate
counts, subscription/application, policy/cap/duration, all fourteen input names,
validation/truncation metadata, safe error/issues, a named safety-evidence table,
a bounded build-decision table and workflow reference. Shared formatting escapes
untrusted HTML/Markdown and defensively redacts confidential names. Success counts
accepted deletion requests; physical removal is never claimed.

Notifications and summaries share `describeCleanupOutcome`: clean dry-run/no-op/
apply is success; safely blocked dry-run with complete inventory is warning;
errors, incomplete inventory, unknown/partial outcomes and blocked apply remain
failure. Summary failure preserves outputs and the operation outcome. Inputs,
retention, discovery and delete orchestration are unchanged. Production SAP
eligibility remains unverified with no bypass.

## Published provenance

- Authorized [package-only publication 43678067818](https://github.com/commercekit-tools/action-kit/actions/runs/43678067818): PASS.
- Publication main: `3fecce40414d709884fa48e48eca278f470b20b0`.
- Reviewed source before merge: `475cc4db42f79310240496201f90d7047aa54330`.
- Registry version: **0.0.6**; shasum `8030f643d1dd6d741caa2c3c0ba321ad82b30cca`.
- Verified integrity:
  `sha512-n6F84900sDPBeYm5dnf8HLCM9B2DUVATEeF717dqKsSXTJtq1FIj/3hZ2UcNTtXe7v8R90HYF6HIom4auM8Kyw==`.
- The published artifact matches reviewed SHA256
  `e4b79576328c2992a96fed087e9ba6e63970e8b54d6fca976a6652702a7a73a9`.

## Normal validation

Registry frozen installation, public metadata/schema/export checks, normal
bundle regeneration and full `pnpm quality` passed with the reviewed local
Sandbox. All **388 tests in 17 files** passed with zero skips. Coverage is
**99.81% statements, 99.62% branches, 100% functions and lines**; all 98% thresholds
and production-file inclusion remain unchanged. Bundle consistency,
metadata/actionlint, public scanning (72 files), full dependency audit (no known
vulnerabilities) and `git diff --check` passed. Actual bundled Sandbox execution
verified all inputs/counts/issues, status/table formatting, masking and zero
target mutations. Required hosted checks must pass on the final PR head.

Normal registry bundle SHA256:
`ab30073d8bb01ee4e120ba58f57737af2a9fd99b94bffb7cc52b83a80d004f9f`.
This is the regenerated registry bundle, distinct from the earlier candidate
bundle fingerprint. No candidate environment flag or package source checkout
was used. Commands actually run: `pnpm install --no-frozen-lockfile`,
`pnpm install --frozen-lockfile`, `pnpm bundle`, public export/schema assertions,
`CLEANUP_SANDBOX_PATH=<reviewed checkout> pnpm quality`, local actionlint and
`git diff --check`.

The earlier exact-source candidate results, including security regressions for
mixed-case encoded credentials and canonical webhook hosts, are archived at
immutable [4686db93](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/4686db93bbf0accbf232a82874421920d4598b56/docs/consistent-reporting.md).
That pre-publication procedure and its normal-registry BLOCKED state describe
historical evidence. It is not the current dependency/build path.

No live SAP or notification-provider validation is implied by package publication
or local Sandbox success. Action releases, Git tags, deployment and real deletion
remain prohibited in this task; remaining production gates are unchanged.
