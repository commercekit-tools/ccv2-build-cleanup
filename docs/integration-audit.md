# Integration audit

## Published shared reporting 0.0.6

The owner authorized package publication and green merges for the coordinated
reporting changes. [Package-only run 43678067818](https://github.com/commercekit-tools/action-kit/actions/runs/43678067818)
published **0.0.6** from action-kit main `3fecce40414d709884fa48e48eca278f470b20b0`.
Registry integrity matches the reviewed source artifact:
`sha512-n6F84900sDPBeYm5dnf8HLCM9B2DUVATEeF717dqKsSXTJtq1FIj/3hZ2UcNTtXe7v8R90HYF6HIom4auM8Kyw==`.
Cleanup now uses the real registry dependency and regenerated normal lock/bundle,
with ccv2-client **0.0.3** unchanged. There are no local dependency links or
candidate overrides. See [consistent-reporting.md](consistent-reporting.md) for
current format, provenance and validation. Required checks on the normal final
head must pass before merge. Production eligibility and owner release gates
remain blocked; no Git tag, Action release, deploy, provider send or real SAP
operation is authorized.

## Historical pre-0.0.6 validation evidence

The following records retain earlier 0.0.5 and pre-publication evidence. Current
0.0.6 results are recorded above and in consistent-reporting.md.

**Compatible Notify: PASS.** [PR #18](https://github.com/commercekit-tools/notify/pull/18)
merged as `6331ff4a60956a3a2b546e84d737c9338ca46bda` after normal registry-backed
quality and CodeQL passed. [CI run 43668192744](https://github.com/commercekit-tools/notify/actions/runs/43668192744)
passed 107 tests in 12 files, 19 schema fixtures and six standalone provider
cases. [CodeQL run 43668192753](https://github.com/commercekit-tools/notify/actions/runs/43668192753)
and the processed PR security check passed. Both providers show the complete
redacted input context, counts, failure explanations and warning issues.

## Published notification context 0.0.5

**PASS — publication:** the owner-authorized package-only
[run 43667757934](https://github.com/commercekit-tools/action-kit/actions/runs/43667757934)
published notification-contract **0.0.5** from action-kit main
`7cc2e8e6af46e7438064cc6205b22f4f7154eb94` after PR #12 merged. Its registry
integrity matches the previously validated source-packed artifact:
`sha512-SMcyyWaeHdtlztt99xtWlJycSAspSTGvCaWJH7M2+u+on77JHwo8boTBOc9UUC0BQHDPo/VHmOj4gpt/XIbqmw==`.

The cleanup consumer upgrade targets exact published 0.0.5 with ccv2-client
**0.0.3** unchanged. Registry frozen installation, regenerated lockfile/bundle,
lint, strict types, coverage with actual bundled local Sandbox, bundle consistency,
metadata/actionlint, public scan and audit passed. The 372 tests in 16 files had
zero skips and 99.81% statement, 99.62% branch, 100% function/line coverage.
Required hosted validation and CodeQL passed on cleanup implementation
`ac5cbcc2fdf1054a891a7a00e1527299b4627130`, now pinned by all examples. The shared cleanup factory,
schema/types and validation now support cleanup-only warning, all 14 sanitized
input settings, safe error/issues and protected/blocked counts. OAuth/transport,
shared sanitization/context/link APIs and Notify delivery remain reused.

The candidate preparation procedure is archived at immutable cleanup commit
[`fb566f6d2268f663a0ea8e0f43890ea5eb818e33`](https://github.com/commercekit-tools/ccv2-build-cleanup/tree/fb566f6d2268f663a0ea8e0f43890ea5eb818e33).
It is historical evidence, not a normal dependency or validation prerequisite.
See [notification-context.md](notification-context.md) for provenance and current
remaining release gates. Real SAP eligibility and operational safety gates remain.

## Historical published-contract 0.0.4 adoption

The earlier cleanup upgrade consumed published notification-contract **0.0.4** and
ccv2-client **0.0.3** through their existing public exports. The lockfile and
standalone bundle are generated from normal registry installation; no candidate
source alias, developer-local dependency or unpublished version is used.

- notification-contract 0.0.4 registry integrity:
  `sha512-y1kTB/s049V0DGLoQZd4s+vlFscShG5wS5g2H4WH6t6rRSOuJrKiCy42dcNlx5wC7NAy6hQuYoTFOQVQ1+PVoA==`.
- Publication source: action-kit `a03da9366e6483040d504a742c1a95413c1202cb`;
  [package-only run 43622416072](https://github.com/commercekit-tools/action-kit/actions/runs/43622416072).
- Compatible Notify: merged `832f6bd04b1889d0d3b4d47a1b2dc0e110985c73`.
- Cleanup upgrade base: `ae42942c18f2ca48f6b4286c31089cf629865796`.
- CI sandbox source: merged `4af998a4783ffa54dd5d7835bfc0dcc4dd382e14`,
  containing the reviewed cleanup fixtures and dependency updates.

`createBuildCleanupEvent` and shared event validation are used directly from
the selected published package. Existing shared sanitization/context/link APIs
and ccv2-client OAuth/cache/transport/retry/encoding APIs remain in use. Notify
continues to own all Slack/Teams rendering and webhook delivery. No new shared
package, local auth implementation or delivery subsystem was introduced.

The normal test suite validates emitted events using actual registry APIs, and
CI executes the actual standalone bundle against the existing local sandbox.
The retained patch/provenance artifacts and the original snapshot’s candidate
scripts are historical evidence, not normal dependency or coverage prerequisites. SAP eligibility remains
unverified; no deletion bypass, production enablement, deployment or release
tag is part of this upgrade. Current executed outcomes are recorded in
[validation-report.md](validation-report.md).

## Original inspection and candidate phase

The remainder records the initial pre-publication state. Statements about the
old 0.0.3 event gate and candidate-only validation describe that historical phase.

Inspected local clean source trees on 2026-11-13 (local calendar transitioned to
2026-11-14 UTC during validation). Cleanup started with no commits or action
implementation; existing `.idea/` and `.iml` files were preserved and ignored.
No ancestor AGENTS.md was found. Sandbox AGENTS.md was read by its integration
worker; the original sandbox working tree's unrelated IDE file was preserved.

| Repository  | Inspected base SHA                                 |
| ----------- | -------------------------------------------------- |
| action-kit  | `9aeded72cf1faaf4441a24ff8c9510daab06e2ca`         |
| ccv2-build  | `d34456cf3682caa2e4a9c61543c334e4d9a08585`         |
| ccv2-deploy | `5dfd6480c3fe60f51327998bcf547d082e70138d`         |
| notify      | `5823c40c70a7daa83112a52a4de29569fe3d9bb0`         |
| sandbox     | `ec545e81f0d3f7151572d925905ebdabe84d8f47`         |
| cleanup     | unborn main; feature branch `feat/initial-cleanup` |

Package manifests, READMEs, public exports/types, tests, package/release guides
and build/deploy adapters were inspected. Exact GitHub Packages registry queries
and frozen installation verified both published **0.0.3** packages; older README
publication statements were not used as evidence. Lockfile records registry
integrities:

- ccv2-client: `sha512-AkGkMm0KPWsvq34/EHYIYQBgnNfS7eXby3O5z5Gpw6sLTGaoLQReA65UubYsEE+3KKg7dwLtRNknuZfhKDa4Wg==`
- notification-contract: `sha512-+TPMHceFbOTxFetmIfBa7s4y+JrBW+0ZpgnOHce7n6vldeRF2sVeNuDa/9jTYmh1q2R1oNSFiOLAIC6ODUIAQg==`

Reused public APIs: TechnicalUserTokenManager, createCcv2Client,
encodeCcv2PathSegment, endpoint validators and Ccv2TransportError; shared
sanitizeBoundedText, sanitizeErrorMessage, redactKnownSecrets,
extractSafeGitHubContext, safe URL helpers and validateNotificationEvent.
No local OAuth, token cache, HTTP client, backoff or webhook implementation.
Read 401 replay uses shared bounded behavior; unsafe DELETE replay is disabled.

Published contract 0.0.3 supports only check/build/deployment events. Minimal
additive event/schema/factory and Notify presentation patches are in
`integration/`. Original repositories remain unchanged. Candidate tarball
provenance and regressions are recorded there; it is not a published 0.0.3.
Normal cleanup lockfile and bundle consume registry 0.0.3 and emit an empty event
with a visible compatibility warning until publication is authorized separately.

SAP references and unresolved eligibility/operational gates are in
`sap-api-contract.md`. Sandbox has existing OAuth, run isolation, build and
operational APIs; only focused control-plane fixtures/races and deletion
initiation behavior were added as a candidate patch. No new toolkit/package.

Sandbox candidate is an isolated feature branch `feat/build-cleanup-scenarios`
with final commit `04fe32f7b1233eb6f080bf8debd47c54c371c8a7`; its patch
SHA-256 is `181e9949ebbcb38770b38fe7d918e03474aeec70023dd9bf5e978c3e2b673f57`.
The initial audit was local-only. The owner subsequently authorized pushing four
feature branches for draft review; `pr-handoff.md` records exact pushed heads and
rebased bases. Consumer examples now pin the pushed cleanup implementation.
