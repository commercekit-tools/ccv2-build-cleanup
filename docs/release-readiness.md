# Release readiness

**BLOCKED. Unreleased. No production deletion or publication is authorized.**

The normal registry-installed action builds reproducibly against ccv2-client
0.0.3 and notification-contract 0.0.3. Its notification output is empty because
that published schema has no cleanup event. Candidate patches, packed-source
integration and Notify regressions demonstrate a compatible additive path;
they are not a supported registry release. No fake version, local package link,
third shared package, release tag or package publication is used.

Gates before release or real apply:

1. Obtain authoritative evidence for four-hour modification eligibility and
   production API rejection before acceptance, or a supported eligibility API.
   Completion time is not that evidence. The production adapter stays closed.
2. Review active deployment/green/canary/rollback and backup reference coverage
   against the supported APIs and the target subscription. Incomplete evidence
   must continue to block apply. Offset pagination remains non-transactional.
3. Review/commit dependent action-kit and Notify patches on feature branches,
   obtain publication approval separately, publish an exact supported contract
   version, pin that version and an immutable compatible Notify commit, regenerate
   the cleanup lockfile/bundle and rerun all checks. No publication in this task.
4. Grant this repository package-read access to both packages and read access to
   candidate source repositories for CI. Fork workflows may not have access;
   use reviewed trusted branches without exposing privileged credentials.
5. Review validation evidence, coverage, bundle, security scans, workflow lint,
   candidate changes, legal ownership and immutable consumer pins. Configure
   required branch check `validate` and CodeQL in repository settings separately.
6. Complete separately authorized non-production validation and obtain owner
   approval. Sandbox success is insufficient for any of these production gates.

## Future controlled non-production validation

1. Obtain explicit authorization for a named non-production subscription and
   read-only credentials. Configure a bounded manually invoked dry-run workflow.
2. Run dry-run, review completeness/protection decisions against the portal,
   including current deployments, scheduled work, snapshots/backups and latest N.
   Save the sanitized artifact and workflow link; investigate every discrepancy.
3. Identify one explicitly approved disposable build. Independently verify all
   deletion requirements, supported last-modification evidence, absence of live
   references and that removal is acceptable. Deletion has no promised recovery.
4. Only after **separate destructive authorization**, set a reviewed workflow to
   apply with max-deletions=1, a narrow exact application scope and explicit
   exclusions for all other candidates. Coordinate deployment workflows and
   review the immutable plan. Do not set production enablement in this task.
5. Confirm HTTP acceptance and eventual portal state separately. HTTP 204 means
   initiated, not physically removed. On unknown outcome stop, inspect portal
   and audit evidence, and do not automatically replay. Save findings and obtain
   a new approval before expanding scope or enabling a recurring apply schedule.

Consumer examples pin the pushed, unreleased cleanup implementation commit. No
cleanup release/tag exists, and the notification example still requires a future
supported compatible Notify pin after the publication gate. See pr-handoff.md
for draft-review branches and updated source provenance. Repository validation
never runs against SAP credentials.
