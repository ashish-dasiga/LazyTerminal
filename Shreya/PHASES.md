# Ordered Phases and Exit Criteria

## S1 — Capability audit

**Build:** Audit CLI contracts and current frontend expectations. Verify Windows installation/launch/auth prerequisites for Claude Code, Codex CLI and Gemini CLI; separately verify whether Antigravity supports a stable automation interface. Mark unknowns honestly.

**Exit criteria:** A matrix lists verified, unverified and unsupported capabilities; no invented install commands or provider parity.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## S2 — CLI discovery

**Build:** Implement host-side discovery, version/path checks, installed/authentication status where reliably detectable, and structured capability responses.

**Exit criteria:** Tests cover missing executable, version response, invalid path and unavailable auth signal.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## S3 — Agent launch adapters

**Build:** Implement separate launch configurations for verified tools, working-directory selection, environment handling without leaking secrets, process/session integration and provider-specific unsupported states.

**Exit criteria:** At least one verified agent launches in the selected project; launch errors and manual auth are handled; no credentials logged.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## S4 — Run/debug integration

**Build:** Implement safe launch/stop/status for configured project tasks, capture output and exit codes, and report ports without assuming they are externally reachable.

**Exit criteria:** Tests cover start, stop, failed command, long-running process and port/status reporting.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## S5 — Preview MVP

**Build:** Implement one real web-project preview workflow (document chosen project type and prerequisites), status/stop handling, and a secure LAN preview access plan. Explicitly state unsupported native/desktop preview types.

**Exit criteria:** End-to-end test opens a supported project preview on an authorized device; unavailable preview is shown honestly.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.
