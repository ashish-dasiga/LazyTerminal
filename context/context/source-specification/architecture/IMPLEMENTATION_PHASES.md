# Implementation Phases and Exit Criteria

## Phase 0 — Repository/frontend audit
Inventory existing code, inspect `.dht`, read all specs, choose no stack yet, document architecture/transport choices.

## Phase 1 — Build skeletons
Prove Android APK and Windows EXE can build/install. Integrate supplied frontend skeletons.

## Phase 2 — Pairing
Implement PC service lifecycle, fresh secret generation/display, Android entry, valid/invalid pairing, connection state.

## Phase 3 — Terminal
Implement Windows shell sessions, working directory, streaming output, errors, cancellation.

## Phase 4 — Files and editor
Browse/edit/save PC files, external change detection, conflict detection.

## Phase 5 — Git and CLI adapters
Implement Git status/diff and selected actions; detect and launch at least one supported CLI in a selected folder; handle auth/setup.

## Phase 6 — Preview
Implement one real project-aware preview path and explicit unsupported/approximate states.

## Phase 7 — Offline queue and sync
Persist tasks, reconnect review, conflict-aware file changes, user-approved task execution, results.

## Phase 8 — Optional cloud investigation
Verify current no-cost options and limits. Enable only if safe and sustainable; otherwise document disabled state.

## Phase 9 — QA and deployment hardening
Run regression and packaging tests; complete `modules/13_SECURITY_DEPLOYMENT_LATER.md`.

## Phase rule
Do not begin the next phase until the current exit criteria and test results are recorded in `state/PROGRESS.md`.
