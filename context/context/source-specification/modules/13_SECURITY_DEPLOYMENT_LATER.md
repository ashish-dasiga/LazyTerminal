# Module 13 — Security Hardening During Deployment (Planned Later)

## 13.1 Timing and scope
The user wants to prioritize getting the app working and perform the full security-hardening pass during deployment. This module is intentionally scheduled late in the implementation plan.

**Important:** Deferring comprehensive hardening does not permit an unauthenticated command server or unrestricted file access during development. Basic safeguards are required from the first working build.

## 13.2 Minimum development safeguards
- Validate pairing before accepting commands or file operations.
- Restrict file access to user-authorized roots.
- Validate paths and reject traversal.
- Require confirmation for destructive/privileged operations.
- Do not log pairing secrets or provider tokens.
- Keep cloud execution disabled unless explicitly configured.
- Clearly show which machine/environment will execute a task.
- Avoid running the app with administrator privileges unless absolutely necessary.

## 13.3 Deployment-stage threat model
Review risks from:
- Unauthorized device pairing
- Guessing/replay of pairing secrets
- Network interception or malicious peers
- Command injection and shell quoting errors
- Malicious paths and archive traversal
- File overwrite/race conditions
- Credential leakage
- Dependency/supply-chain compromise
- Unintended internet exposure
- Cloud workspace leakage or quota abuse
- Malicious/duplicate queued tasks
- Compromised updates/installers

## 13.4 Deployment hardening checklist
- Secure transport and peer identity validation.
- Secret entropy, expiry, rotation, rate limiting, and replay resistance.
- Device/session revocation and explicit trust management.
- Least-privilege process execution.
- Filesystem sandbox/allowlist and path validation tests.
- Secure token storage and official OAuth/provider flows.
- Secret-safe logs and diagnostic exports.
- Dependency audit and software bill of materials.
- Installer/update integrity and signing where feasible.
- Firewall/NAT exposure review.
- Local cache retention and deletion.
- Protocol fuzzing and malformed-message tests.
- Security regression suite.
- Clear permission and consent UX.
- Documented incident/revocation procedure.

## 13.5 Acceptance
Before public deployment, complete the checklist, record remaining risks, and do not label the product production-secure without evidence from tests/review.
