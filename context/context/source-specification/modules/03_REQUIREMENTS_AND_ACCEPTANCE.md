# Module 03 — Functional Requirements, Non-Functional Requirements, and Acceptance Tests

## 3.1 Functional requirements

### FR-01 — Installable products
Produce a Windows EXE installer and an Android APK. Neither product may require the user to open a browser dashboard.

### FR-02 — PC startup secret
Every time the PC communication service starts, generate a fresh random secret using a cryptographically secure random source and display it in the PC app.

### FR-03 — Pairing
Android accepts the current PC secret. Valid pairing establishes a session; invalid or unreachable pairing shows a useful error and retry action.

### FR-04 — Terminal-first workspace
After successful pairing, Android opens the terminal as its default connected view.

### FR-05 — Persistent navigation
Explorer, Editor, Source Control, CLI launcher, Preview, and More Options remain available in a compact top bar/menu/navigation region while a terminal or CLI session is active.

### FR-06 — Shell
Run normal PowerShell/CMD commands on Windows, support a working directory, stream output, report exit status, and handle cancellation/termination.

### FR-07 — Files
Browse authorized folders; open, edit, and save files; detect external modifications and conflicts.

### FR-08 — Git
Expose status/diffs and supported repository actions. Errors and merge conflicts must be visible.

### FR-09 — CLI providers
Detect supported CLIs, show installation/auth state where detectable, and launch in the selected project directory. Initial requested targets: Claude Code, Codex CLI, Gemini CLI, VS Code command-line integration, and Antigravity where a supported launch mechanism exists.

### FR-10 — Provider authentication
Use official sign-in/authentication flows where supported. Do not collect provider account passwords directly or fabricate token/quota data.

### FR-11 — Preview
Offer project-aware preview/output with an explicit indication of live, approximate, output-only, or unavailable preview.

### FR-12 — Offline queue
When PC is unavailable, preserve prompts, eligible local edits, and queued tasks on Android. PC-bound tasks remain pending and are not marked executed.

### FR-13 — Reconnection
When PC returns, detect pending work, request user review, detect conflicts, apply approved changes, execute approved tasks, and return results.

### FR-14 — Optional cloud
Cloud execution is optional, isolated, and disabled unless an approved no-cost option is configured. Disclose quotas and account requirements.

### FR-15 — State documentation
Update `state/PROGRESS.md` and `state/DECISIONS.md` after each phase.

## 3.2 Non-functional requirements
- No mandatory paid infrastructure.
- Native installable user experience.
- Clear disconnected/offline/sync states.
- Robust error handling and recoverability.
- Maintainable modular code.
- Minimal, documented dependencies.
- No committed secrets.
- Basic safeguards exist throughout development.
- Testable protocol and queue state transitions.
- UI preserves the supplied frontend design when technically compatible.

## 3.3 Required test scenarios
1. Valid pairing succeeds.
2. Invalid secret is rejected.
3. Restarting PC service generates a new secret; old secret no longer works.
4. PC unreachable produces a useful timeout/retry state.
5. Android opens terminal after successful connection.
6. `pwd`/`cd`/`dir` or equivalent, plus `git status`, execute on PC and return output.
7. File saved from Android appears on PC.
8. External file change is detected before overwrite.
9. Missing CLI shows actionable setup instructions.
10. CLI launches in the selected folder where supported.
11. Offline task persists across Android restart.
12. Offline PC task is not reported as executed.
13. Reconnection sync asks for review and detects conflicts.
14. Preview truthfully identifies its capability level.
15. Build process produces installable APK and EXE.
16. No localhost browser UI or mandatory paid service is introduced.

## 3.4 Definition of done
A phase is complete only when its acceptance tests pass or every failure is recorded as a known limitation with a concrete next step.
