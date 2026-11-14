# Unpublished notification compatibility candidates

Published notification-contract **0.0.3** cannot represent cleanup. The normal
registry-installed cleanup bundle safely leaves `notification-event` empty and
reports this compatibility gate. It never labels cleanup as a build or file check.

These focused dependent patches prepare the minimum extension to the existing
notification-contract package and notify presentation layer. They add no package,
OAuth, transport, provider delivery, or webhook implementation. Both original
working trees remain unchanged. Candidate branches exist only in isolated local
clones; no commits, PRs, publication, merge, tag, or deploy were performed.

The matching candidate contract factory is `createBuildCleanupEvent`, producing
`ccv2.build-cleanup.completed` using the existing completed status vocabulary.
It projects schema-approved fields and calls the shared validator. Notify's
existing Slack and Teams providers render its common presentation.

Apply `action-kit-cleanup-event.patch` to action-kit base
`9aeded72cf1faaf4441a24ff8c9510daab06e2ca`, and `notify-cleanup-renderer.patch`
to notify base `5823c40c70a7daa83112a52a4de29569fe3d9bb0` in disposable checkouts.
Install each repository's frozen dependencies with authorized read access, then:

```sh
# In candidate action-kit checkout
pnpm exec tsc -p packages/notification-contract/tsconfig.json
(cd packages/notification-contract && node ../../scripts/copy-schema.mjs)
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec vitest run
(cd packages/notification-contract && npm pack --ignore-scripts --pack-destination "$CANDIDATE_OUTPUT")
```

Unpack that exact source tarball in an isolated workspace and install its declared
runtime dependencies. Use it only in the isolated notify candidate integration,
then run `pnpm typecheck`, `pnpm bundle`, and `pnpm test` there. The recorded local
integration used the real unpacked tarball through an isolated dependency mount;
it did not alter a registry lockfile or the upstream worktrees.

From the cleanup checkout, set `CLEANUP_CANDIDATE_PACKAGE` to the unpacked package
directory, then run:

```sh
pnpm exec vitest run --config integration/vitest.candidate.config.ts
```

The adapter tests exercise actual candidate factory and validation, outcome
mapping, scope/context/error sanitization, and accurate deletion-request language.
Full existing action-kit and notify tests preserve compatibility for old events.
See `candidate-provenance.json` for source bases, patch digests, exact tarball
integrity, and executed results. This candidate package retains its source
manifest version for provenance; it is **not** a registry-supported 0.0.3 build.
No candidate tarball or machine-specific dependency is in the normal lockfile.

Normal notification/release readiness is **BLOCKED** until separately authorized
publication provides an exact supported package version and an immutable tested
notify commit. The candidate source requires version selection and consumer pin
updates at that later stage. No current notify SHA is claimed to support cleanup.

## Automated isolated preparation

The `prepare-candidate.mjs` script verifies the audited clean action-kit source
checkout, creates a temporary source copy, applies the patch, performs a frozen
install, builds and typechecks the contract, runs all action-kit tests, packs the
exact modified source, then installs that tarball into a fresh temporary package.
It writes the candidate directory to `GITHUB_ENV` for CI, or to the optional
`CLEANUP_CANDIDATE_PATH_FILE` for local use. Dependencies are installed only in
temporary directories; the cleanup registry lockfile remains unchanged.

```sh
CLEANUP_ACTION_KIT_PATH=/path/to/audited/action-kit \
CLEANUP_CANDIDATE_PATH_FILE=/tmp/cleanup-candidate-path \
  node integration/prepare-candidate.mjs
CLEANUP_CANDIDATE_PACKAGE="$(cat /tmp/cleanup-candidate-path)" pnpm test:coverage
```

The main Vitest configuration runs published-package tests and isolated candidate
adapter tests as separate projects, combining coverage without excluding any
production source. A plain test run needs no candidate; the full coverage gate
requires the prepared candidate until cleanup support is published. Candidate
preparation needs read access to the pinned action-kit source checkout and public
registry dependencies. Repository/package permissions may limit fork CI.

Executed automated preparation: PASS (277 upstream tests). Combined cleanup
coverage at validation: 270 passed, 1 skipped, statements 100%, branches 99.75%, functions 100%,
lines 100%. This proves candidate compatibility and does not establish published
notification support or authorize release.

The automated preparation path used by `validate` is:

```sh
CLEANUP_ACTION_KIT_PATH=/path/to/clean/audited/action-kit node integration/prepare-candidate.mjs
```

It verifies the base and tracked working tree, copies source into a temporary
workspace, applies the focused patch, frozen-installs/builds/tests, packs the
exact package and installs that tarball in an isolated workspace. It exports
`CLEANUP_CANDIDATE_PACKAGE` through GITHUB_ENV in CI; locally set
`CLEANUP_CANDIDATE_PATH_FILE` to capture the path. With that environment set,
`pnpm test:coverage` runs both published and candidate projects and enforces the
98% thresholds across all cleanup production code together.

`integration/build-candidate-bundle.mjs` separately builds identical cleanup
source against that exact installed candidate in a temporary workspace. Its
local dependency mounts are disposable test setup, never a committed lockfile,
normal bundle or registry dependency. It records the candidate bundle SHA-256.
`CLEANUP_CANDIDATE_BUNDLE_FILE` captures its path. The local sandbox launcher can
then test this bundle with `CLEANUP_ACTION_BUNDLE` and validate its real event
using `CLEANUP_EVENT_CONTRACT_PATH`. Normal `dist` remains registry-derived and
has the explicit unsupported-event gate. CI validates both bundles.
