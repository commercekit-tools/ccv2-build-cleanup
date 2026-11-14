# Release readiness

**BLOCKED for real SAP apply and an Action release. The action remains unreleased.**

The notification compatibility gate is resolved by consuming exact published
`@commercekit-tools/notification-contract@0.0.4` alongside existing
`@commercekit-tools/ccv2-client@0.0.3`. Normal installation, bundling, schema
validation and notification-output tests use the registry dependency. No local
package link, source alias or candidate tarball is required for the normal build.

Contract 0.0.4 was published through the authorized
[package-only workflow](https://github.com/commercekit-tools/action-kit/actions/runs/43622416072)
from action-kit commit `a03da9366e6483040d504a742c1a95413c1202cb`.
Compatible Notify commit
`832f6bd04b1889d0d3b4d47a1b2dc0e110985c73` was merged after registry-backed
validation and CodeQL passed. Package publication did not create an Action
release or Git release tag and does not authorize SAP deletion.

Remaining gates before an Action release or real apply:

1. Obtain authoritative evidence for four-hour modification eligibility and
   production API rejection before acceptance, or a supported eligibility API.
   Completion time is not that evidence. The production adapter stays closed.
2. Review active deployment/green/canary/rollback and backup reference coverage
   against supported APIs and the target subscription. Incomplete evidence must
   continue to block apply. Offset pagination remains non-transactional.
3. Review the exact cleanup commit, published-package lock integrity, regenerated
   bundle, valid notification output and compatible immutable Notify pin. Keep
   all required validation/CodeQL checks green; no release is implied by merge.
4. Verify this repository has package-read access to both existing packages.
   Fork workflows may not have access; use reviewed trusted branches without
   exposing privileged credentials or using pull_request_target. Consumers of
   the bundled action need no package-registry credentials.
5. Review local and hosted validation evidence, coverage, bundle consistency,
   security scans, workflow lint, ownership and consumer configuration. Configure
   required branch check `validate` and CodeQL separately where needed.
6. Complete separately authorized non-production validation and obtain owner
   approval. Sandbox success is insufficient to establish SAP guarantees.

## Future controlled non-production validation

1. Obtain explicit authorization for a named non-production subscription and
   read-only credentials. Configure a bounded manually invoked dry-run workflow.
2. Run dry-run and review completeness/protection decisions against the portal,
   including current deployments, scheduled work, snapshots/backups and latest N.
   Save the sanitized artifact and workflow link; investigate every discrepancy.
3. Identify one explicitly approved disposable build. Independently verify all
   deletion requirements, supported last-modification evidence, absence of live
   references and that removal is acceptable. Deletion has no promised recovery.
4. Only after **separate destructive authorization**, set a reviewed workflow to
   apply with max-deletions=1, a narrow exact application scope and explicit
   exclusions for all other candidates. Coordinate deployment workflows and
   review the immutable plan. Do not set production enablement in this task.
5. Confirm HTTP acceptance and eventual portal state separately. HTTP 204 means
   initiated, not physically removed. On unknown outcome stop, inspect portal
   and audit evidence, and do not automatically replay. Save findings and obtain
   a new approval before expanding scope or enabling recurring apply.

Consumer examples use reviewed immutable commits. No cleanup Action release/tag
exists. Repository validation uses the local sandbox and synthetic data; it never
runs against SAP credentials. This upgrade must not create release tags, deploy
anything, or enable real deletion. See [pr-handoff.md](pr-handoff.md) for the
historical integration sequence and current published-contract adoption.
