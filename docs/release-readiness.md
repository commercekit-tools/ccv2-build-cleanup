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

## Main branch protection — configured 2026-11-14

**PASS:** classic branch protection for the exact `main` branch was applied with
GitHub's branch-protection API and independently read back at
**2026-11-14 18:33 UTC**. Main was
`29f49c0b1489543fbde145a9af1ef4ba6a3db428` when configured. The branch API now
returns `protected=true`; there were no existing protection rules or inherited
rulesets to replace. This repository setting is separate from Action releases
and consumer cleanup enablement.

| Setting                               | Verified value                                      |
| ------------------------------------- | --------------------------------------------------- |
| Required status check                 | `validate`, GitHub Actions app ID **15368**         |
| Required status check                 | `CodeQL`, GitHub Advanced Security app ID **57789** |
| Require branch to be up to date       | **Enabled** (`required_status_checks.strict=true`)  |
| Enforce protection for administrators | **Enabled** (`enforce_admins.enabled=true`)         |
| Allow force pushes                    | **Disabled**                                        |
| Allow branch deletion                 | **Disabled**                                        |
| Required approving reviews            | Not configured (field absent in API read-back)      |
| Additional push-identity restrictions | Not configured (field absent in API read-back)      |

Use the exact required check names shown above. `CodeQL` is the processed PR
code-scanning check from GitHub Advanced Security; the Actions workflow's
`analyze` job is a separate check. Successful checks on the reviewed PR supplied
the observed app IDs. Required checks are bound to those producers using the
API's `checks` entries, rather than accepting an identically named status from
any source. See the
[GitHub branch-protection API](https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection)
for `checks.app_id`, `strict` and administrator-enforcement semantics.

Verify the live policy with authorized repository access:

```sh
gh api repos/commercekit-tools/ccv2-build-cleanup/branches/main/protection
gh api repos/commercekit-tools/ccv2-build-cleanup/branches/main
# On a current PR, verify GitHub recognizes the required checks:
gh pr checks <PR_NUMBER> --repo commercekit-tools/ccv2-build-cleanup --required
```

Merge through a reviewed PR only after the exact required checks pass on the
current head with main up to date. Keep these names/producers stable or update
the protection deliberately when changing workflows. Do not bypass or disable
the policy to merge a failing change. No reviewer-count, signature, linear-history
or environment-approval requirements were introduced by this configuration.

## Remaining gates before an Action release or real apply

1. **BLOCKED — SAP eligibility evidence:** obtain authoritative evidence for
   four-hour modification eligibility and production API rejection before
   acceptance, or a supported eligibility API. Completion time is not that
   evidence. The production adapter retains `eligibilityVerified=false` with
   no bypass.
2. **BLOCKED — operational protection review:** verify active deployment,
   green/canary/rollback and snapshot/backup reference coverage against supported
   APIs and the target subscription. Incomplete protection evidence and
   unstable/incomplete inventory block apply. Pagination remains non-atomic;
   preflight does not eliminate the check/delete race.
3. **BLOCKED — owner release review and consumer setup:** review the exact cleanup
   commit, registry lock integrity, bundle, notification output, ownership and
   consumer configuration. Configure one authoritative workflow per subscription,
   coordinate deployments and keep real deletion disabled. Green branch checks
   do not constitute release approval.
4. **BLOCKED — separately authorized non-production validation:** complete the
   controlled runbook below and obtain owner approval. Real SAP read/dry-run and
   destructive validation have not been performed. Sandbox success does not
   establish production SAP guarantees.
5. **Access limitation:** trusted-main registry installation and pre-/post-merge
   validation are proven; see [validation-report.md](validation-report.md).
   Fork workflows may lack package access. Use reviewed trusted branches without
   exposing privileged credentials or using `pull_request_target`. Consumers of
   the bundled action need no registry credentials.
6. **NOT RUN:** hosted sandbox smoke and live Slack/Teams webhook delivery. Dedicated
   process-cancellation and network-timeout sandbox E2E fixtures remain unexecuted;
   related unit/integration coverage is recorded separately in the validation
   report. No live SAP operation is implied by repository or sandbox tests.

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
