# Integration handoff and history

## Published-contract upgrade

The owner subsequently authorized package publication, registry consumer
upgrades and green-checked source merges. Notification-contract **0.0.4** was
published from action-kit main `a03da9366e6483040d504a742c1a95413c1202cb` by
[run 43622416072](https://github.com/commercekit-tools/action-kit/actions/runs/43622416072),
without creating Git release tags. Notify was upgraded from the actual registry
package and merged at `832f6bd04b1889d0d3b4d47a1b2dc0e110985c73` after quality
and CodeQL passed.

This cleanup upgrade pins that published version, regenerates its normal
lockfile/bundle and verifies a nonempty validated cleanup notification. Candidate
source preparation is no longer a normal CI/coverage requirement. The local
sandbox source used by CI is merged commit
`4af998a4783ffa54dd5d7835bfc0dcc4dd382e14`; no unpublished fixture patch is
needed. Consumer examples pin the validated registry-backed cleanup commit
`d7363059d4ef523a40e8df912c03ee1215200224`. Current validation results belong in
[validation-report.md](validation-report.md), and remaining SAP/Action-release
gates are in [release-readiness.md](release-readiness.md).

The action is still unreleased. Source/package integration does not authorize
production deletion. This upgrade must not create release tags, deploy or enable
real deletion.

## Original draft-review record

The following is the historical pre-publication handoff. Its draft-only status,
0.0.3 notification gate and initial branch heads are not current release claims.

The owner authorized feature-branch pushes and draft PR creation on 2026-11-14.
This does not authorize merges, publication, tags or real deletion.

All four branches are pushed:

| Repository | Branch                         | Initial pushed head                        |
| ---------- | ------------------------------ | ------------------------------------------ |
| cleanup    | `feat/initial-cleanup`         | `37d560786d9b119206a24ddf83158b3cc1994fbd` |
| action-kit | `feat/build-cleanup-event`     | `05eb3240a036dd4afaf191921aa7bbb2ba4bf168` |
| notify     | `feat/build-cleanup-event`     | `604884949dbcc99b8789dbabd2ae38931afa653f` |
| sandbox    | `feat/build-cleanup-scenarios` | `5ded738ccab77f640ce40714d1d3bec77b1285c8` |

Cleanup's remote was empty. An empty main baseline
`31a279e71369c1b851620005d13739e73aa172a1` was created solely to make a
comparable PR; implementation was not merged into main. The initial pushed
cleanup implementation has exactly the tree previously validated at local
snapshot `31e144032f0e7381facaa8cffc1857c9157c2822`. Examples now pin the
immutable pushed implementation SHA instead of an unavailable tag/placeholder.

Notify and sandbox were rebased onto current main before push. Their current
main trees matched the originally audited source trees. Notify additionally
needed schema-parity fixture registration and cleanup provider snapshots;
88 tests, schema checks (17 fixtures), typechecking, lint/format, public scan
and candidate bundle generation pass. No fake published dependency pin or local
package link was committed. Registry-only Notify rebuild remains blocked until
separately authorized publication provides the compatible contract.

Sandbox's rebased candidate passed all 63 tests and both typechecks. Its source
patch is unchanged and has no Cloudflare configuration change. Action-kit passed
277 tests, full typecheck and focused formatting/lint. Cleanup's full suite
passed 301 tests with 100% coverage across all metrics; see validation-report.md
for original command evidence and explicit NOT RUN/BLOCKED scenarios.

No release, merge, tag, deployment, production enablement, webhook delivery or
real SAP deletion is part of this handoff. Four-hour SAP eligibility evidence,
operational safety review, supported contract publication/pinning and separately
authorized non-production validation remain blockers. GitHub-hosted CI must be
reviewed independently from local evidence.

PR #1 security remediation is commit
`29d454c1d0ff02a3619d325936ae00c2bc94a3a7`. Consumer examples now pin this
validated audit/CodeQL fix instead of the initial implementation. The action
remains unreleased and all SAP eligibility/publication gates remain in force.
