# Existing sandbox integration

Normal cleanup validation uses the published
`@commercekit-tools/notification-contract@0.0.4` dependency and the committed
`dist/index.js`. There is no candidate package alias, packed-source dependency
mount, or alternate bundle in this validation path.

The existing CommerceKit sandbox includes the merged cleanup fixture/race
controls. CI pins the merged source commit
`4af998a4783ffa54dd5d7835bfc0dcc4dd382e14`; it does not apply a local patch or
change Cloudflare configuration. No sandbox deployment is part of this work.

The sandbox implements OAuth form/resource authentication,
`x-approuter-authorization`, optional `x-sandbox-run-id` verification, isolated
runs, build listing/details/deletion, deployments, snapshots, environments,
backups, bounded scenarios, and state inspection. Hosted conventions remain
`https://ccv2.sandbox.commercekit.tools` and `/sandbox/v1/`; automated cleanup
validation executes the local Workers runtime only.

## Run locally

Use Node 24 and each repository's declared pnpm version. In a separate sandbox
checkout, select the pinned source and install its own frozen dependencies:

```sh
git checkout --detach 4af998a4783ffa54dd5d7835bfc0dcc4dd382e14
pnpm install --frozen-lockfile
pnpm run ci
```

Then, from cleanup:

```sh
pnpm install --frozen-lockfile
pnpm bundle
CLEANUP_SANDBOX_PATH=/path/to/isolated/sandbox pnpm test:coverage
```

`tests/e2e/local-sandbox.test.ts` invokes `scripts/sandbox/local-e2e.mjs` when the
explicit checkout path is supplied. The script starts the pinned sandbox using
`wrangler dev --local`, creates a temporary HTTPS certificate and synthetic
signing material, executes the actual committed action bundle, observes target
operation counts, and removes every created run in `finally`. It trusts the
local certificate through the child process's `NODE_EXTRA_CA_CERTS`; TLS
verification is not disabled. Port 18787 is the default, configurable with
`CLEANUP_SANDBOX_PORT`. OpenSSL must be installed.

Without an explicit sandbox path, the E2E wrapper is skipped. That is not a
passing end-to-end result; full CI supplies the pinned checkout. No hosted
smoke, live provider delivery or SAP validation is automatic.

## Notification output and safety evidence

Every action execution must emit a nonempty `notification-event`, bounded to
64 KiB and parsed by the actual installed 0.0.4 package. The launcher verifies
the public package metadata/schema and checks the event type, source, run
instant, shared status mapping, mode, exact scope, policy, every shared aggregate
count, duration, safe error code and workflow context against the result report.
It also checks that credential values and sandbox control tokens do not appear
in the event. This includes handled failures and eligibility-blocked apply;
a failure output must remain useful and valid before the action exits nonzero.

The bundle matrix covers OAuth and 401 refresh, 429/500 read recovery,
105-build multi-page double inventory, mixed states and age/count protections,
deployed/snapshot/exclusion protections, scheduled/current deployment references
versus historical failed records, exact empty application scope, repeat runs,
malformed flags, pagination drift, 403 authorization failure, and report/output/
summary consistency. Fixture setup and run teardown use authenticated sandbox
control operations; target API mutation counters are asserted separately.
Both dry-run and eligibility-blocked apply must have **zero target mutations**.

The production adapter still reports `eligibilityVerified: false`. Publishing
a notification contract does not establish SAP's four-hour modification
eligibility or authorize deletion. The fixture control plane can simulate
recent internal modification, reference races, disappearance and ambiguous
acceptance; its metadata is never presented as a production SAP field or
enforcement guarantee. `DELETED` remains a stored record after 204, modeling
initiation rather than physical removal.

Destructive orchestration is tested separately with injected verified evidence.
The real adapter exposes no sandbox-only bypass. Successful, capped and ambiguous
DELETE orchestration through the production-adapter bundle remains blocked by
missing SAP eligibility evidence. Passing this local matrix proves neither
production guarantees nor permission to release or perform real deletion.

## Scenario execution status

| Scenario                                                                                                                 | Status             | Evidence / limitation                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Multi-page mixed inventory, old/recent, fewer than N, no candidates, exclusions, deletion-marked, missing/invalid fields | PASS               | Actual bundle and sandbox runtime fixtures; start-time ties also occur in sandbox fixture tests                    |
| Deployed/snapshot protection                                                                                             | PASS               | Actual bundle; late deployed change and snapshot rejection in sandbox runtime tests                                |
| Scheduled/current deployment references versus historical failed deployments                                             | PASS               | Actual bundle fixtures and explicit reason checks                                                                  |
| Recent internal modification despite old completion                                                                      | PASS               | Sandbox DELETE rejection; metadata never appears in vendor reads                                                   |
| Token refresh, 403, read 429/500                                                                                         | PASS               | Actual bundle with shared client against deterministic sandbox faults                                              |
| Pagination drift, disappearance                                                                                          | PASS               | Actual bundle drift fixture; runtime control supports removal                                                      |
| DELETE initiation retained as a record; accepted then ambiguous response                                                 | PASS               | Sandbox runtime tests; no physical disappearance is claimed                                                        |
| Destructive bundled cap/unknown handling, final deletion race and exact accepted target set                              | BLOCKED            | Production adapter deliberately cannot establish eligibility; orchestration tests use injected evidence separately |
| Snapshot appearing during final revalidation                                                                             | NOT RUN in sandbox | Fixture patching supports it; assess cleanup's separate execution tests                                            |
| Sandbox read timeout, actual token expiry, cancellation/deadline during a slow network request                           | NOT RUN in sandbox | 401 refresh exercised; transport/deadline/abort tests are separate                                                 |
| Hosted smoke, live SAP read-only/dry-run, approved destructive SAP validation                                            | NOT RUN            | Explicit configuration and separate live authorization required                                                    |

## Historical candidate validation

The initial audit inspected sandbox base
`ec545e81f0d3f7151572d925905ebdabe84d8f47`. Focused fixture changes were first
validated in isolated candidate branch `feat/build-cleanup-scenarios` at
`04fe32f7b1233eb6f080bf8debd47c54c371c8a7`, then rebased and reviewed before
merging the fixture source. The original patch and exact provenance are recorded
in the integration audit and review handoff. The normal test path now consumes
the merged pinned source directly.

Initial validation used existing sandbox dependencies and direct constituent
checks because that temporary harness's symlinked dependency setup blocked the
canonical `pnpm run ci`. Subsequent refreshed branch validation passed the full
canonical sandbox CI, all 63 sandbox tests, both typechecks, OpenAPI, generated
types, formatting, lint and dry-run bundling. The original isolated checkouts and
Cloudflare configuration were preserved. Historical candidate notification
validation preceded registry publication; it is not used to satisfy current
published-package coverage or bundle checks.
