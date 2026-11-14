# Integration audit

## Published-contract adoption

The cleanup action now consumes published notification-contract **0.0.4** and
ccv2-client **0.0.3** through their existing public exports. The lockfile and
standalone bundle are generated from normal registry installation; no candidate
source alias, developer-local dependency or unpublished version is used.

- notification-contract 0.0.4 registry integrity:
  `sha512-y1kTB/s049V0DGLoQZd4s+vlFscShG5wS5g2H4WH6t6rRSOuJrKiCy42dcNlx5wC7NAy6hQuYoTFOQVQ1+PVoA==`.
- Publication source: action-kit `a03da9366e6483040d504a742c1a95413c1202cb`;
  [package-only run 43622416072](https://github.com/commercekit-tools/action-kit/actions/runs/43622416072).
- Compatible Notify: merged `832f6bd04b1889d0d3b4d47a1b2dc0e110985c73`.
- Cleanup upgrade base: `ae42942c18f2ca48f6b4286c31089cf629865796`.
- Local/CI sandbox source: merged `4af998a4783ffa54dd5d7835bfc0dcc4dd382e14`,
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
