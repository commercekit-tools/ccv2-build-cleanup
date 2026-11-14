# Retention and safety

The action captures `runStartedAt` once. All comparisons use UTC instants and the
same cutoff throughout the run:

```text
cutoff = runStartedAt - retention-days × 24 hours
```

The pure evaluator accepts projected build data, policy, operational evidence and
that clock instant. It performs no network operations. Its frozen result contains
per-build reasons, retention candidates, eligible targets, the bounded plan and
eligible targets deferred by the cap. Input and API validation precede evaluation.

## Combined retention

1. Select the exact application code when configured. An empty result stays empty.
2. Rank all non-deleted builds in that scope by `buildStartTimestamp` descending,
   with ascending build code as the deterministic tie-breaker. Deployed, active,
   excluded and snapshot-protected builds participate in this ranking.
3. Protect the latest `keep-latest` builds.
4. Protect completion timestamps at or after the cutoff. Age uses
   `buildEndTimestamp`, independently of start-time ranking.
5. Apply operational protections to builds outside both retention protections.

With `keep-latest: 10` and `retention-days: 30`, a build must be outside the latest
10 **and** have completed strictly more than 30 days before run start. Equality at
the cutoff stays protected. Missing or invalid timestamps never authorize deletion.
A missing/invalid start timestamp in any non-deleted build blocks reliable ranking
and apply for the whole scope. Duplicate identities also block ranking.

Only `SUCCESS` and `FAIL` are allowed terminal statuses. Unknown, queued, scheduled
and active builds remain protected. Existing deletion markers are excluded from
the count floor and cannot become candidates.

## Operational protections

The evaluator protects deployed builds, active deployment references, snapshots,
verified backup dependencies, explicit exclusions and existing deletion markers.
Missing `deployed` or `hasSnapshot` fields remain unknown; they are never converted
to `false`. Failed or incomplete protection discovery is never an empty reference
set. Unknown deployment state or unsupported current relationship evidence blocks
apply.

The required reason vocabulary is:

| Reason                         | Meaning                                         |
| ------------------------------ | ----------------------------------------------- |
| `retained-latest`              | In the latest-N count floor                     |
| `retained-age`                 | Completion is at/after the cutoff               |
| `explicitly-excluded`          | Exact identifier exclusion                      |
| `active-build`                 | Non-terminal or unknown build status            |
| `deployed`                     | Build explicitly reports deployed               |
| `active-deployment-reference`  | Current/active operational deployment reference |
| `snapshot-or-backup-reference` | Snapshot or verified backup dependency          |
| `already-marked-for-deletion`  | Existing deletion state/marker                  |
| `missing-timestamp`            | Required timestamp absent or invalid            |
| `eligibility-unverified`       | Missing safety/eligibility evidence             |
| `incomplete-inventory`         | Incomplete inventory or unreliable ranking      |
| `invalid-api-response`         | Contradictory required build data               |

Reasons can overlap. Their totals are not mutually exclusive disposition counts.

## SAP eligibility release gate

SAP documents terminal status, absence of deployment, and last modification more
than four hours ago as deletion conditions. Completion time is not last modification.
This version does not invent a modification timestamp, infer eligibility from a
30-day age, or treat sandbox behavior as evidence of SAP enforcement.

The production API adapter sets `eligibilityVerified: false`. Accordingly,
retention candidates remain `eligibility-unverified` and real deletion is blocked
until supported eligibility evidence or authoritative API-side enforcement is
established and separately reviewed. There is no action input to bypass this gate.
Sandbox/unit adapters may supply verified synthetic evidence only for isolated tests.

## Frozen plan and final revalidation

Eligible targets are ordered by oldest completion first, then ascending build
code. At most `max-deletions` distinct targets enter the immutable plan. The cap
bounds attempted targets, including failures and absent builds. Execution never
refills it.

Dry-run executes the read-only planning path and makes zero target API mutations.
Apply processes the frozen targets sequentially. Before every DELETE it reconciles
inventory and operational references, fetches target details, checks scope and
identity, recomputes the retention floor and checks cancellation/deadline. New
protection shrinks the execution set. A previously blocked target is not retried.

A preflight 404 means already absent. A DELETE 404 is conservatively also recorded
as already absent and never counted as an accepted deletion request. HTTP 204 means
**deletion initiated**, not physical removal. The action does not wait for removal
or offer recovery.

Definitive build-local rejection can continue only when explicitly configured.
Authentication/authorization failure, cancellation, deadline, missing safety
information and ambiguous mutation outcomes stop destructive operations. A lost
response or ambiguous server result is `outcome-unknown`; the action does not
blindly replay the mutation. Earlier accepted requests remain visible in partial
results. Preflight checks cannot eliminate the check/delete race; no transactional
or ETag guarantee is claimed.
