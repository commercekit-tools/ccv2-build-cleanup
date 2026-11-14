# Contributing

Use Node 24.21.0 and pnpm 12.6.0. Work on feature branches. MIT licensing and
CommerceKit ownership follow the existing action repositories.

Configure GitHub Packages authentication in your user-level configuration using
an authorized read-only credential. The committed `.npmrc` contains only the
scope registry. Never print credentials or commit them. Then run:

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm bundle
```

Full coverage validation additionally prepares the exact-source notification
candidate and local sandbox described in `integration/README.md` and
`docs/sandbox-testing.md`; normal registry packages do not support cleanup events.
Run `pnpm test:coverage`, `pnpm bundle:check`, `pnpm metadata:check`,
`pnpm scan:public` and `pnpm audit`. Coverage thresholds are 98% in all metrics,
including the entry point and destructive orchestration. Do not weaken them.

Commit source, lockfile and `dist` together. Package installation is required
only for development; consumers execute the bundle. Keep retention pure and
network operations in endpoint adapters/orchestration. Reuse action-kit auth,
transport and notification contracts. Provider delivery belongs to Notify.

No contribution or sandbox success authorizes publication or SAP deletion.
Read the release gates before any non-production apply experiment.
