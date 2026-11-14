# SAP API contract and unresolved safety gate

Inspected 2026-11-13 using the current official SAP Cloud Portal documentation.
The local sandbox is a simulator and is not evidence of production enforcement.

| Operation                      | Verified contract                                                                                                                                                          | Official reference                                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| List builds                    | `GET /v2/subscriptions/{subscriptionCode}/builds`; `$top`, `$skip`, `$orderby`, optional `$count`; collection `value`, total `count` when requested                        | [getBuilds](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/452dcbb0e00f47e88a69cdaeb87a925d/9d7854f5297a400e9c8ce3a2819d3c82.html)                     |
| Read build                     | `GET /v2/subscriptions/{subscriptionCode}/builds/{buildCode}`; identity, application, status, start/end timestamps, `hasSnapshot`, `deployed`                              | [getBuild](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/452dcbb0e00f47e88a69cdaeb87a925d/9041daaf93c144acb4726f0c86e58337.html)                      |
| Request deletion               | `DELETE /v2/subscriptions/{subscriptionCode}/builds/{buildCode}`; empty `204` means initiation                                                                             | [deleteBuild](https://help.sap.com/docs/r/452dcbb0e00f47e88a69cdaeb87a925d/v2211/en-US/f789a8969c5f4d3792977469936fd50b.html)                                     |
| List deployments               | `GET /v2/subscriptions/{subscriptionCode}/deployments`; documented filters/pagination; status, build/environment code, previous deployment/canary/traffic information      | [Official OpenAPI](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/0fa6bcf4736c46f78c248512391eb467/66abfe678b55457fab235ce8039dda71.html?locale=en-US) |
| Read environments              | `GET /v2/subscriptions/{subscriptionCode}/environments`; `value`, `count`, `deploymentStatus`; optional status filters                                                     | [getEnvironments](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/452dcbb0e00f47e88a69cdaeb87a925d/04a3ab885fa84717800d302b05f61391.html)               |
| Read modeled backup references | `GET /v2/subscriptions/{subscriptionCode}/environments/{environmentCode}/databackups`; `value`, `count`; `databackupCode`, `buildCode` (nullable in QUICK backup examples) | [getDatabackups](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/452dcbb0e00f47e88a69cdaeb87a925d/c4cc4780f12147a7b3d50c3d618e4637.html)                |

The [official overview](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/0fa6bcf4736c46f78c248512391eb467/66abfe678b55457fab235ce8039dda71.html?locale=en-US)
limits paginated endpoints to **100 items per request**. The action uses `$top=100`
and offsets, requests counts, checks duplicate/count/drift behavior, and does not
claim an atomic inventory snapshot. Supported sorting syntax is a list of
attribute names with `asc`/`desc`; no specific build-start server ordering is
assumed. The action ranks validated `buildStartTimestamp` locally.

Build statuses documented in the OpenAPI are `BUILDING`, `SUCCESS`, `FAIL`,
`SCHEDULED`, `DELETED`, and `UNKNOWN`. Deployment status vocabulary is
`SCHEDULED`, `DEPLOYING`, `DEPLOYED`, `UNDEPLOYED`, and `FAIL`. Historical
undeployed/failed records are distinct from current operational references.
Unknown or contradictory required operational evidence is a blocker.

## Eligibility gate: BLOCKED

[Deleting a Build](https://help.sap.com/docs/SAP_COMMERCE_CLOUD_PUBLIC_CLOUD/0fa6bcf4736c46f78c248512391eb467/d1195ea0b9f149809d579a1251b797e3.html)
describes terminal SUCCESS/FAIL, absence of current deployment, and modification
older than four hours as prerequisites. Its documented enforcement example is a
disabled portal button. That does not establish API-side rejection before
acceptance. The inspected API schema has no build last-modified timestamp.
`buildEndTimestamp` is completion time and must not substitute for modification.

No authoritative API guarantee for the four-hour rule was established. The
production adapter therefore supplies `eligibilityVerified: false`; affected
retention candidates are `eligibility-unverified` and real deletion is blocked.
Neither retention age nor passing sandbox tests clears this gate. Obtain a
supported evidence source or an authoritative SAP API enforcement commitment,
review protection coverage and complete separately authorized non-production
validation before enabling production deletion. There is no bypass input.

A `204` is reported as **deletion requested**, never physically deleted. SAP
states that marking a build for deletion prevents deployment and cannot be
reversed. This action does not wait for eventual removal or promise recovery.
Preflight reads cannot eliminate the check/delete race; no ETag, conditional
DELETE, transaction, or cross-repository lock is claimed.
