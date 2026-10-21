# Ordered Phases and Exit Criteria

## D1 — Adapter and state audit

**Build:** Inspect `src/services/contracts.ts`, `src/services/index.ts`, context and mocks. Write an integration map: every UI operation, contract method, current mock behavior, required real operation, and error state. Preserve existing screens.

**Exit criteria:** Mapping covers every existing service domain; no source UI changes; contract gaps documented before edits.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## D2 — Real adapter boundary

**Build:** Implement the production adapter/service wiring behind the existing contracts, connection lifecycle/error mapping, timeout/retry policy, streaming bridge and environment/config selection. Keep mock adapter available for tests/development only.

**Exit criteria:** App can select real vs mock adapter deliberately; TypeScript checks pass; adapter tests cover offline/errors and no accidental mock success.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## D3 — Android packaging proof

**Build:** Select and document a suitable wrapper/native shell for the existing React UI. Prove a debug APK builds and installs; wire lifecycle, secure local persistence and keyboard/back behavior with minimal UI changes.

**Exit criteria:** Reproducible APK build instructions and an installable debug APK; core supplied screens visually match baseline.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## D4 — Offline queue and reconciliation

**Build:** Persist eligible drafts/commands locally, sequence and deduplicate them, track queued/needs-review/approved/running/succeeded/failed/skipped states, compare against current PC state, surface stale/conflict conditions, and require explicit approval before replay.

**Exit criteria:** Restart-safe queue tests; reconnect does not auto-execute; duplicate replay prevented; stale/conflicting tasks require review; result state visible.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.

## D5 — Integration gate

**Build:** Integrate the host, filesystem/Git and CLI/preview adapters through documented interfaces; run cross-feature checks and produce a known-limitations report.

**Exit criteria:** Build/lint/test commands and device/host checklist documented; mocks clearly distinguished from real operations.

**Commit gate:** After the exit criteria pass, create a separate descriptive Git commit, record the hash in `HANDOFF.md`, and only then begin the next phase.
