# Security

Report vulnerabilities privately through this repository's GitHub Security
Advisories. Do not include SAP credentials, tokens, webhook URLs or raw API
responses in public issues.

This unreleased action defaults to read-only dry-run. Real deletion remains
blocked by unverified production eligibility. There is no bypass input. Runtime
dependencies are bundled; consumers need no package credentials. Development
requires authorized GitHub Packages read access, never a committed token.

OAuth, endpoint/redirect restrictions, masking and HTTP policies come from
`@commercekit-tools/ccv2-client`. Reporting uses the existing notification
contract sanitizers. The action projects endpoint data and does not log raw
responses. Reports contain sanitized build identifiers and policy decisions;
restrict artifact access and retention as appropriate for your organization.

CI never uses pull_request_target. Forked PRs may lack package access; review
and run in a trusted branch without granting untrusted code privileged tokens.
Do not supply production SAP or notification secrets to repository validation.
