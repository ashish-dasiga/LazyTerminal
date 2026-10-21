# Mobile–PC Development Environment
## Antigravity Implementation Specification — v2

**Purpose:** A professional, phased product specification for building two final installable applications:
1. **Android APK** — mobile development console.
2. **Windows EXE** — Windows companion, local execution engine, and connection service.

This repository is the agent's source of truth. Read it before writing code.

---

## Start here: mandatory agent sequence

1. Read `PROJECT_OVERVIEW.md`.
2. Read all files in `modules/` in numeric order (`01` through `13`).
3. Read `architecture/SYSTEM_ARCHITECTURE.md`, `architecture/WORKFLOW_SPEC.md`, and inspect `assets/workflow_diagram.png`.
4. Read `contracts/PROTOCOL_AND_DATA_CONTRACT.md`.
5. Read `frontend_handoff/FRONTEND_HANDOFF.md`.
6. Read `state/PROGRESS.md` and `state/DECISIONS.md`.
7. Read `examples/EXAMPLE.md`.
8. Inspect the actual repository and any user-supplied `.dht` frontend artifact.
9. Report your understanding, existing code inventory, unknowns, and proposed implementation stack.
10. Implement only the current phase named in `state/PROGRESS.md`.

Do not skip ahead or generate the whole product in one pass.

## Non-negotiable requirements

- Exactly two final deliverables: one Android APK and one Windows EXE installer.
- The Android app opens to a **terminal-first connected workspace** after successful pairing.
- Explorer, code editing, Source Control, CLI launcher, Preview, and More Options remain accessible through compact persistent navigation.
- The mobile interface must not show macOS/desktop window controls.
- On every start of the PC communication service, generate a fresh random pairing secret and display it in the PC app. The user enters that secret in Android to pair.
- The PC is the execution environment for PC files, PowerShell/CMD commands, Git, and Windows CLIs.
- While the PC is off, the phone can draft prompts, edit cached/local copies, and queue tasks. PC commands do not execute until the PC is available.
- Optional cloud coding may be explored only as a separate mode with explicit free-tier limits and no mandatory paid infrastructure.
- Target cost is ₹0. Do not add AWS, paid APIs, paid databases, paid relays, or billing-enabled mandatory services.
- Do not build two localhost-hosted browser apps or require the user to open `localhost:8008`, `localhost:8080`, or similar.
- A communication transport is still needed; choose and document a native app-to-app transport. “No localhost web dashboard” does not mean “no networking.”
- The user will provide frontend code in a `.dht` file. Inspect and preserve it; do not replace it with a generic mockup.
- Security hardening is a later deployment phase, but baseline safe handling of pairing, paths, and destructive operations is required during development.

## Folder map

| Path | Purpose |
|---|---|
| `PROJECT_OVERVIEW.md` | Product summary, problem, goal, constraints |
| `modules/01_PROBLEM_STATEMENT.md` | Problem and user needs |
| `modules/02_SOLUTION_AND_SCOPE.md` | Proposed solution and scope boundaries |
| `modules/03_REQUIREMENTS_AND_ACCEPTANCE.md` | Functional/non-functional requirements and acceptance criteria |
| `modules/04_UX_AND_FRONTEND_INTEGRATION.md` | Mobile UX and frontend handoff |
| `modules/05_SYSTEM_ARCHITECTURE.md` | Components, boundaries, architecture decisions |
| `modules/06_PROTOCOL_AND_DATA_CONTRACTS.md` | Message contracts, state model, error model |
| `modules/07_WINDOWS_COMPANION_AND_INSTALLER.md` | Windows EXE and runtime responsibilities |
| `modules/08_ANDROID_APP_AND_WORKSPACE_UI.md` | Android APK and persistent terminal-first workspace |
| `modules/09_TERMINAL_CLI_GIT_AND_FILES.md` | Commands, CLI providers, auth, Git, files |
| `modules/10_OFFLINE_SYNC_AND_OPTIONAL_CLOUD.md` | Offline queue, reconciliation, optional cloud |
| `modules/11_PREVIEW_SYSTEM.md` | Project-aware preview rules |
| `modules/12_DEPENDENCIES_BUILD_TESTING.md` | Dependencies, env, ignore rules, testing, packaging |
| `modules/13_SECURITY_DEPLOYMENT_LATER.md` | Deployment-stage security plan |
| `architecture/` | System architecture and workflow source |
| `assets/workflow_diagram.png` | Approved visual workflow diagram |
| `contracts/PROTOCOL_AND_DATA_CONTRACT.md` | Shared protocol/data reference |
| `examples/EXAMPLE.md` | Inputs and expected behaviours/output |
| `state/PROGRESS.md` | Phase progress and next step |
| `state/DECISIONS.md` | Architecture decisions and open questions |
| `frontend_handoff/` | User-supplied `.dht` frontend code |
| `prompts/START_HERE.md` | Copy-ready Antigravity prompt |
| `.env.example` | Safe configuration template |
| `.gitignore` | Excludes secrets and build artefacts |

## How to work

- Use the documents as requirements, not as optional inspiration.
- Inspect existing code before changing files.
- Preserve working code and user-provided frontend.
- Keep Android UI, Windows execution, protocol, CLI adapters, and cloud adapters separated.
- Add tests with each capability.
- Do not fake unsupported integrations or report mock output as real execution.
- Record dependency purpose, version, license, install requirements, and any cost implications.
- At the end of every phase, update `state/PROGRESS.md` and `state/DECISIONS.md`.
- If requirements conflict with a platform/provider limitation, explain the conflict and propose the closest truthful implementation before changing scope.
