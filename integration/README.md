# Notification integration evidence

**Compatible Notify: PASS.** [PR #18](https://github.com/commercekit-tools/notify/pull/18)
merged as `6331ff4a60956a3a2b546e84d737c9338ca46bda` after normal registry-backed
quality and CodeQL passed. [CI run 43668192744](https://github.com/commercekit-tools/notify/actions/runs/43668192744)
passed 107 tests in 12 files, 19 schema fixtures and six standalone provider
cases. [CodeQL run 43668192753](https://github.com/commercekit-tools/notify/actions/runs/43668192753)
and the processed PR security check passed. Both providers show the complete
redacted input context, counts, failure explanations and warning issues.

Notification-contract **0.0.5** was published by the authorized
[package-only run 43667757934](https://github.com/commercekit-tools/action-kit/actions/runs/43667757934)
from action-kit main `7cc2e8e6af46e7438064cc6205b22f4f7154eb94`.
Its registry integrity matches the previously tested source artifact:
`sha512-SMcyyWaeHdtlztt99xtWlJycSAspSTGvCaWJH7M2+u+on77JHwo8boTBOc9UUC0BQHDPo/VHmOj4gpt/XIbqmw==`.
Cleanup's exact registry repinning, normal lockfile/bundle and local validation
passed, including 372 tests and actual bundled local Sandbox. Required hosted validation and CodeQL also passed on the immutable
cleanup implementation pinned by the examples; see
[notification-context.md](../docs/notification-context.md).

The 0.0.5 source-packed preparation script and then-current instructions are
archived in immutable cleanup snapshot
[`fb566f6d2268f663a0ea8e0f43890ea5eb818e33`](https://github.com/commercekit-tools/ccv2-build-cleanup/tree/fb566f6d2268f663a0ea8e0f43890ea5eb818e33)
([instructions](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/fb566f6d2268f663a0ea8e0f43890ea5eb818e33/docs/notification-context.md),
[script](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/fb566f6d2268f663a0ea8e0f43890ea5eb818e33/integration/validate-notification-candidate.mjs)).
It verified the exact artifact and tested isolated private consumers before
publication. It is historical evidence; no source dependency, candidate alias,
alternate bundle or action-kit checkout is needed by normal development or CI.

## Historical pre-publication integration artifacts for 0.0.4

The earlier cleanup installation and validation used exact published
`@commercekit-tools/notification-contract@0.0.4`. That package exports
`createBuildCleanupEvent`, its shared cleanup types/schema and validation.
Normal CI and coverage tests require no candidate package, source alias,
action-kit source checkout or alternate candidate bundle.

Publication provenance:

- Source: action-kit `a03da9366e6483040d504a742c1a95413c1202cb`.
- [Authorized package-only publication run](https://github.com/commercekit-tools/action-kit/actions/runs/43622416072).
- Registry integrity:
  `sha512-y1kTB/s049V0DGLoQZd4s+vlFscShG5wS5g2H4WH6t6rRSOuJrKiCy42dcNlx5wC7NAy6hQuYoTFOQVQ1+PVoA==`.
- Compatible Notify merge: `832f6bd04b1889d0d3b4d47a1b2dc0e110985c73`.

The retained patch files and `candidate-provenance.json` document how the
additive extension was tested before publication. They did not introduce a new package, OAuth/transport code or
provider delivery implementation. The source candidate retained its original
manifest version solely for provenance; it was never claimed as a published
0.0.3 cleanup-capable package and was never placed in the normal registry lock.

To reproduce that historical candidate procedure, use the immutable original
cleanup snapshot
[`2ff0d5280fcd4bcb58f80157ec808230b9400fa8`](https://github.com/commercekit-tools/ccv2-build-cleanup/tree/2ff0d5280fcd4bcb58f80157ec808230b9400fa8)
and its [then-current instructions](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/2ff0d5280fcd4bcb58f80157ec808230b9400fa8/integration/README.md).
That snapshot contains the temporary candidate preparation scripts,
`CLEANUP_CANDIDATE_PACKAGE` test project and alternate bundle used while the event
was unavailable. Those tools are retired from the current build path.

Current development uses `pnpm install --frozen-lockfile`, the normal test suite,
`pnpm bundle`, and the existing local sandbox described in
[docs/sandbox-testing.md](../docs/sandbox-testing.md). CI checks out the actual
merged sandbox source rather than applying an unpublished fixture patch.
Package authentication is needed to install development dependencies, not to run
the bundled Action in consumer workflows.

Historical sandbox and contract test success does not establish production SAP
eligibility. The action remains unreleased and its real-deletion gate remains
closed; no release tag, deployment or deletion enablement is authorized here.
