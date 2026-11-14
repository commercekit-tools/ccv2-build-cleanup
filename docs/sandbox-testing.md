# Existing sandbox integration

Base inspected: `commercekit-tools/sandbox` commit
`ec545e81f0d3f7151572d925905ebdabe84d8f47`. The original checkout and Cloudflare
configuration are untouched. Candidate changes are supplied as
`integration/sandbox-cleanup.patch`; apply them to a separate feature checkout.
No sandbox deployment is part of this work.

The sandbox already implements OAuth form/resource authentication,
`x-approuter-authorization`, optional `x-sandbox-run-id` verification, run
isolation, build listing/details/deletion, deployments, snapshots, environments,
backups, bounded scenarios, and state inspection. The hosted service convention
is `https://ccv2.sandbox.commercekit.tools`; controls use `/sandbox/v1/`.
The cleanup tests prefer local Cloudflare Workers runtime execution.

The focused extension adds an authenticated control-plane cleanup-fixture PUT,
internal modification/race configuration, acceptance followed by an ambiguous
500 response, and operation observation. Production-shaped build DTOs are not
extended. `DELETED` remains a stored record after a 204, modeling initiation.
Build-local eligibility rejection now includes snapshots, unknown state and
operational deployment references. Fixture metadata simulates the four-hour
check; it does not prove SAP exposes or enforces it.

## Run locally

Use Node 24 and the sandbox's declared pnpm version. In an isolated checkout:

```sh
git checkout -b feat/build-cleanup-scenarios ec545e81f0d3f7151572d925905ebdabe84d8f47
git apply /path/to/ccv2-build-cleanup/integration/sandbox-cleanup.patch
pnpm install --frozen-lockfile
pnpm run ci
```

Then, from cleanup after installing its dependencies and building `dist`:

```sh
pnpm install --frozen-lockfile
pnpm bundle
CLEANUP_SANDBOX_PATH=/path/to/isolated/sandbox pnpm test:e2e
```

`tests/e2e/local-sandbox.test.ts` starts `scripts/sandbox/local-e2e.mjs` when the
explicit path is supplied. The script launches the existing sandbox Worker with
remote bindings disabled, creates a temporary HTTPS certificate and signing
material, executes the actual bundled action, observes target operation counts,
and removes every created run in `finally`. It trusts the local certificate with
`NODE_EXTRA_CA_CERTS`; it does not disable TLS verification. It uses port 18787
unless `CLEANUP_SANDBOX_PORT` is configured. OpenSSL must be installed.

Without the explicit checkout path, the local sandbox test is skipped; that is
not a passing end-to-end validation. CI must supply the pinned candidate checkout
and build the bundle before this test. No hosted smoke is automatic.

## Evidence and limits

The local bundle matrix covers 105-build pagination, mixed states, age/count
protections, deployed/snapshot/exclusion protections, exact application scope
with an empty result, repeat runs, malformed flags, pagination drift, read 429
and 500 recovery, 401 refresh, 403 stop, report/output/summary consistency, and
zero target mutations in both dry-run and eligibility-blocked apply.

The candidate sandbox runtime tests cover initiation without physical
disappearance, internal recent modification, deployment/snapshot races,
unknown states, accepted then ambiguous responses, fixture authorization,
isolation, and duplicate seed keys. Existing sandbox regression tests remain
part of validation. Destructive orchestration with verified injected evidence is
tested separately in cleanup unit/integration tests; the real adapter has no
sandbox-only eligibility bypass.

The production eligibility gate intentionally prevents bundled sandbox apply
from demonstrating successful DELETE orchestration. Do not describe those
blocked runs as deletion tests. Cancellation/deadline, cap and continuation
coverage must be assessed in the cleanup validation report. Passing these local
tests does not establish production safety guarantees or authorize publication.

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

Final sandbox candidate branch in the isolated checkout is
`feat/build-cleanup-scenarios`, head
`04fe32f7b1233eb6f080bf8debd47c54c371c8a7` (base
`ec545e81f0d3f7151572d925905ebdabe84d8f47`). Candidate commits were created
only in the temporary clone; no remote branch or PR was created.

Validation used existing installed sandbox dependencies with explicit Node
`24.21.0`: direct Prettier, ESLint, main/test TypeScript checks, OpenAPI validation,
Cloudflare runtime Vitest, `wrangler types --check`, and
`wrangler deploy --dry-run`. The last command builds locally and exits without
deployment. The canonical `pnpm run ci` was attempted but blocked by this local
harness's symlinked dependency tree/package-manager setup; constituent checks
were run directly. A fresh checkout must use its own frozen installation.
