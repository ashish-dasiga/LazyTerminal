# Ordered Phases and Exit Criteria

## A1 — Host audit and runnable skeleton

**Build:** Audit existing repo and choose/justify the smallest suitable Windows companion technology consistent with current spec. Create host project skeleton, configuration examples, structured logging without secrets, and documented local run/build steps.

**Exit criteria:** Host skeleton builds/runs; no secrets checked in; choices and risks documented.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## A2 — Pairing and connection lifecycle

**Build:** Implement fresh cryptographically secure pairing secret per communication-service startup, expiry/attempt limits, validation, explicit connected/disconnected states and safe local host discovery/handshake. Keep transport decision documented and LAN-first.

**Exit criteria:** Valid/invalid/expired key tests pass; secret is never hard-coded or logged; invalid attempts are rate-limited.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## A3 — Persistent terminal sessions

**Build:** Implement persistent Windows shell sessions (PowerShell first; CMD only if supported), input/output streaming, working-directory persistence, session listing/creation/close, Ctrl+C/cancellation, exit status and process-tree cleanup.

**Exit criteria:** A command sequence proves persistent cwd/environment; output streams incrementally; cancel/close cleans child processes; error cases tested.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## A4 — Frontend contract adapter handoff

**Build:** Expose documented host APIs/events needed by the integration owner, map them to existing contracts where possible, and provide a test harness. Do not edit shared frontend contract files without approval.

**Exit criteria:** Integration guide and payload examples exist; all host APIs have tests; unsupported behavior is explicit.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.
