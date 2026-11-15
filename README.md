# CommerceKit CCv2 Build Cleanup

> **Shared reporting uses published notification-contract 0.0.6.** The normal
> registry dependency, lockfile and standalone bundle include consistent status
> icons, input/result/safety tables and safe issue explanations. Read
> [registry validation](docs/consistent-reporting.md) and the remaining
> [production gates](docs/release-readiness.md). Default dry-run and deletion
> protections remain unchanged.

Unreleased TypeScript GitHub Action for planning safe SAP Commerce Cloud build
retention. It runs once; GitHub Actions owns the schedule. Node 24 and all runtime
dependencies are bundled in `dist/index.js`.

**Dry-run is the default. Real SAP apply is currently blocked:** supported SAP
responses do not prove the documented four-hour last-modification condition.
Candidates receive `eligibility-unverified`; no bypass input exists. See
[release gates](docs/release-readiness.md) before use.

The action consumes the existing `@commercekit-tools/ccv2-client@0.0.3` for OAuth,
token caching/refresh, endpoint restrictions and safe transport. It consumes
`@commercekit-tools/notification-contract@0.0.6` for cleanup-event factories,
validation, safe context, links and sanitization. OAuth/HTTP infrastructure and
webhook delivery are not implemented here. [Integration audit](docs/integration-audit.md) records exact
source SHAs, published-package integrity and historical candidate provenance.

## Combined retention

A build must be **outside the latest N AND older than retention-days**, then pass
all operational checks. With keep-latest=10 and retention-days=30, old builds in
the latest ten remain protected, as do recent builds outside the latest ten.

Count ranking uses `buildStartTimestamp` descending with build-code ties.
Protected/deployed/excluded builds participate in ranking. Completion age uses
`buildEndTimestamp`; equality at the UTC cutoff remains protected. A single
captured run start determines the cutoff. Missing, invalid or contradictory
timestamps protect; completion never substitutes for last modification.

Explicit exclusions, deployed builds, active/scheduled deployment references,
snapshots/backups, unknown/active build states and deletion-marked builds are
protected. Missing flags do not become false. Failed protection reads and
unstable/incomplete inventory block apply. Live green/canary/rollback evidence
that cannot be fully established also blocks apply. Read
[retention and safety](docs/retention-and-safety.md) and
[SAP contract evidence](docs/sap-api-contract.md).

## Inputs

| Input                    | Default / limits                                                 |
| ------------------------ | ---------------------------------------------------------------- |
| token-endpoint           | Required HTTPS technical-user OAuth endpoint                     |
| client-id                | Required technical-user client identifier                        |
| client-secret            | Required secret                                                  |
| resource                 | Required OAuth resource                                          |
| subscription-code        | Required; exactly one subscription                               |
| api-base-url             | `https://portalapi.commerce.ondemand.com`; HTTPS origin only     |
| application-code         | Blank = subscription scope; otherwise exact match                |
| retention-days           | `30`; integer 1–36500                                            |
| keep-latest              | `10`; integer 1–10000                                            |
| dry-run                  | `true`; exact `true` or `false`                                  |
| max-deletions            | `20`; integer 1–100 distinct planned targets                     |
| exclude-build-codes      | Comma/newline exact identifiers, trimmed/deduplicated; max 10000 |
| timeout-minutes          | `15`; integer 1–60                                               |
| continue-on-delete-error | `false`; exact boolean, only definitive build-local rejections   |

Identifiers are validated before path construction. Invalid/fractional/overflow
numbers and malformed booleans fail. An empty exact application scope never
falls back to subscription scope. There are no webhook, force-delete or safety
bypass inputs. The initial scope excludes branch-pattern rules, multi-subscription
orchestration and environment/database/backup deletion.

## Dry-run setup

Use [manual-dry-run.yml](examples/manual-dry-run.yml) in a consumer repository.
The examples pin the locally validated, pushed unreleased implementation commit.
Review that immutable commit before use; there is no `v1` release. Configure only authorized
non-production credentials initially:

- Secrets: CCV2_TOKEN_ENDPOINT, CCV2_CLIENT_ID, CCV2_CLIENT_SECRET, CCV2_RESOURCE.
- Variables: CCV2_SUBSCRIPTION_CODE and optional CCV2_APPLICATION_CODE.
- Consumer workflow permission: `contents: read`. SAP technical-user permissions
  must allow build/deployment/environment and applicable backup reads; delete
  permission is only needed for separately authorized future apply.

No package credentials or installation are needed to run the bundled action.
Development installation needs GitHub Packages `read:packages`; CI grants
`packages: read` only to validation. Never commit credentials. Private package or
source access can limit fork CI; never use pull_request_target to evade that.

## Scheduled operation

[scheduled-cleanup.yml](examples/scheduled-cleanup.yml) runs weekly Sunday 03:17
**UTC**, with a 20-minute job timeout and subscription-scoped concurrency.
Deletion is disabled until the enable variable is literally `true`; initial
scheduled and manual runs are dry-run. Keep that variable unset while release
and SAP evidence gates remain blocked.

| Enable variable                         | Event / manual input                      | Mode                                               |
| --------------------------------------- | ----------------------------------------- | -------------------------------------------------- |
| Missing or anything except exact `true` | Any                                       | Dry-run                                            |
| `true`                                  | schedule                                  | Apply requested (currently blocked by eligibility) |
| `true`                                  | workflow_dispatch; boolean true           | Dry-run                                            |
| `true`                                  | workflow_dispatch; explicit boolean false | Apply requested                                    |
| `true`                                  | Unknown event or missing/malformed input  | Dry-run                                            |

The mode step uses case-sensitive JavaScript checks on serialized manual boolean input, so missing input cannot
coerce to deletion permission. The truth table is unit tested. GitHub schedules
run the default branch, can be delayed, and public repository schedules may be
disabled after inactivity. Concurrency is repository-local; it is no distributed
cross-repository lock. Keep one authoritative workflow per subscription and
coordinate with deployment workflows using the same repository concurrency
policy. Optional environment approvals can add a review gate.

## Execution and outputs

Discovery completes before deletion; offset inventory is counted, deduplicated
and read twice to detect drift. Limits are 100 entries/page, 100 pages/collection,
10000 items/collection, 1500 endpoint calls, 2 MiB/response and the overall deadline.
Reaching a bound blocks apply. The plan is immutable and capped, oldest completion
first, with no refilling. Deletion is sequential; each target revalidates details,
full inventory/retention floor and operational references. No preflight eliminates
the check/delete race.

HTTP **204 means deletion was requested**, not physically completed. The action
does not poll for removal, implement undo, or promise recovery. 404 means already
absent/unconfirmed; ambiguous responses stop further mutation without blind replay.
Authorization, deadline, inventory and safety failures cannot be continued past.

| Output                   | Definition                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------- |
| cleanup-status           | dry-run, no-op, blocked, success, partial-failure, failed, outcome-unknown          |
| dry-run                  | Effective mode                                                                      |
| scanned-count            | Validated builds in the exact selected scope                                        |
| eligible-count           | Passed age, count and all safety checks                                             |
| planned-count            | Eligible targets selected under the cap                                             |
| deletion-requested-count | HTTP 204 accepted initiations                                                       |
| skipped-count            | Scanned minus accepted, failed and unknown dispositions                             |
| failed-count             | Target failures, including preflight failures; global error also appears separately |
| unknown-count            | Targets with ambiguous mutation outcome                                             |
| duration-ms              | Elapsed milliseconds                                                                |
| result-json              | Versioned sanitized JSON, max 64 KiB with explicit omitted-decision count           |
| notification-event       | Validated `ccv2.build-cleanup.completed` JSON from the published shared contract    |
| report-path              | Full sanitized JSON file in a private per-run RUNNER_TEMP directory                 |

Result schema v1 records scope/policy/completeness, counts, decisions, reasons,
accepted/failed/unknown/deferred/unattempted dispositions and safe error codes.
Reasons overlap; they are not disjoint counts. Decision dispositions are disjoint.
The bounded job summary clearly marks DRY RUN/APPLY and never calls a hypothetical
or initiated deletion completed. Upload report-path as an artifact if durable
access is needed. Handled failures write outputs before setting action failure;
report/notification errors cannot erase the original outcome.

## Notifications and validation

Use [cleanup-with-notifications.yml](examples/cleanup-with-notifications.yml).
The action creates and validates `ccv2.build-cleanup.completed` through the exact
published `notification-contract@0.0.6` package. All notifications include the
14 input names, effective settings when valid, validation/truncation flags,
scope, policy, counts and duration. Authentication values are always
`[REDACTED]`; other fields use shared known-secret/JWT sanitization before
truncation. Accepted deletion requests are never reported as physical deletion.

Success shows accepted request counts. A safety-blocked dry-run with complete
inventory and no failed, unknown or accepted targets produces a warning with
safe issue messages. Actual errors, incomplete inventory, partial/unknown
outcomes and blocked apply produce failure with a safe code and explanation.
Notification severity does not change the Action's failure behavior.

The example passes `notification-event` to Notify's `event-json`, uses `always()`
with a nonempty-event guard and keeps webhook secrets only on Notify. It pins
compatible unreleased Notify commit
[`abc752ead104a6e5153c5f166d04ee5e595e0ca6`](https://github.com/commercekit-tools/notify/commit/abc752ead104a6e5153c5f166d04ee5e595e0ca6).
Notify owns Slack and Teams Workflows rendering/delivery. Notification failure
does not hide cleanup failure. Older Notify versions can reject cleanup warning
events. No Action release or version tag is implied by these commits.

Normal validation must use the registry-installed package and the actual bundled
action against the existing local sandbox. Current 0.0.6 results and exact
validation references are recorded in [validation-report.md](docs/validation-report.md).
[Historical integration artifacts](integration/README.md)
retain the pre-publication patches and candidate evidence; candidate source
preparation, dependency aliases and packed-source test bundles are no longer
required by normal CI or coverage validation.

Development uses strict TypeScript, pnpm, Vitest/V8 (98% minimum for all four
coverage metrics), ESLint, Prettier, ncc and the existing local CommerceKit sandbox.
[Sandbox testing](docs/sandbox-testing.md) covers isolated runs and actual bundled
execution. Sandbox metadata is not production SAP evidence. See
[validation report](docs/validation-report.md) for executed commands and remaining
gates, [CONTRIBUTING.md](CONTRIBUTING.md) for setup and [SECURITY.md](SECURITY.md).

Passing validation and consuming a published dependency do not authorize
production cleanup or an Action release.
License: [MIT](LICENSE), CommerceKit.
