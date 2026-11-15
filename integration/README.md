# Notification integration evidence

The current notification-context candidate is documented in
[notification-context.md](../docs/notification-context.md). Reproduce both isolated
consumer validations using `validate-notification-candidate.mjs` and the exact
retained 0.0.5 tarball. No source dependency, local link or candidate bundle is
installed into normal consumer files. Publication/registry readiness is blocked.

The remaining material is historical evidence for the earlier 0.0.4 adoption.

# Historical pre-publication integration artifacts

Normal cleanup installation and validation now use exact published
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
