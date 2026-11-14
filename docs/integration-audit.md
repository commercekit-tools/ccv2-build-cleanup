# Integration audit

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
