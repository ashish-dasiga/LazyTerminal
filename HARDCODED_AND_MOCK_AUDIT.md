# Lazy Terminal — Hardcoded Paths, Mock Data & Fake State Audit

**Generated:** Phase 1 Audit (Updated through Phase 6 verification)

Every hardcoded workspace path, mock dataset, fabricated terminal/agent banner, silent path substitution, and fake timer found across the repository is catalogued below with its exact location and disposition.

---

## 1. Hardcoded Paths & Silent Backend Path Substitution

| Location | Symbol / Lines | Hardcoded / Fake Artifact | Impact | Disposition |
| :--- | :--- | :--- | :--- | :--- |
| `src/context/RelayContext.tsx` | `INITIAL_PROJECTS` (L71–244), `activeProjectId` (L532) | Hardcoded `C:\Projects\hyper-relay` (default active), `C:\Dev\ai-agents\claude-fleet`, `C:\Work\enterprise-dashboard` with fake Rust/Python/TS file trees (`relay_daemon.rs`, `wal_ledger.rs`, `Cargo.toml`, `tunnel.yaml`, `notes.txt`), fake commit hashes (`3f7a8b1`), and fake modified files | Forces nonexistent `C:\Projects\hyper-relay` as default workspace and populates Explorer with fabricated files | **Replace with live `/api/v1/workspace` state** (empty/selector state until validated real Windows folder is selected or restored) |
| `src/host/config.ts` | `FRONTEND_DEMO_PATHS` (L19–25), `resolveRequestedWorkingDir` (L78–86) | Silently rewrites `c:\projects\hyper-relay`, `c:\dev\ai-agents\claude-fleet`, `c:\work\enterprise-dashboard` to `config.defaultWorkspaceRoot` (`process.cwd()`) | Violates Section 4 invariant: hides missing paths by silently substituting another directory | **Remove silent substitution**; validate requested paths strictly against real disk & authorized workspace roots |
| `src/server/fsSecurity.ts` | `DEMO_PROJECT_ROOTS` (L20–24), `normalizeProjectRoot` (L26–33) | Silently maps `c:\projects\hyper-relay` et al. to `process.cwd()` for `/api/v1/fs/*` and `/api/v1/git/*` | Masks nonexistent `C:\Projects\hyper-relay` and serves LazyTerminal repo files under a fake folder label | **Remove silent substitution**; return explicit `404 DIRECTORY_NOT_FOUND` or `403 PATH_NOT_ALLOWED` |
| `src/context/RelayContext.tsx` | `INITIAL_INTENTS` (L477–516), `seedOrListIntents` call (L631) | Seeds 3 fake queued commands targeting `C:\Projects\hyper-relay` (`git commit`, `cargo test`, `git status`) into IndexedDB on first run | Triggers fake offline reconciliation banner on real host connect | **Remove fake initial intents**; start offline queue empty (`[]`) |
| `src/screens/LaptopApp.tsx` & `lazy_terminal_companion.py` | `LaptopApp.tsx` (L56–70, L320–360), `lazy_terminal_companion.py` (L214–231) | Hardcoded simulated sync steps and fake workstation metadata (`DESKTOP-ASHISH-DEV` fallback when hostname differs, fake `sync/run` simulation) | Misrepresents real host sync/workspace status | **Replace with real OS hostname & live host status** |
| `tests/hostApi.test.ts` | `testApi()` (L22, L33, L89, L98) | Uses `C:\Projects\hyper-relay` in test URLs relying on `DEMO_PROJECT_ROOTS` alias | Masked the production aliasing bug during unit tests | **Update test** to use a real disposable temp directory + assert `C:\Projects\hyper-relay` fails cleanly when absent |

---

## 2. Fabricated Terminal Sessions, Shells & AI CLI Banners

| Location | Symbol / Lines | Hardcoded / Fake Artifact | Impact | Disposition |
| :--- | :--- | :--- | :--- | :--- |
| `src/context/RelayContext.tsx` | `INITIAL_SESSIONS` (L274–418) | 8 pre-populated sessions including fake `"PowerShell 7.4"` (`sess-pwsh`), `[Claude Code v1.0.8] Attached to persistent session... ✔ Project indexed: 7 files parsed` (`sess-claude`), `[Gemini CLI v2.5.0] Ready. Authenticated with Google Cloud Project.` (`sess-gemini`), `[Antigravity Agent Runtime v1.2.0] Connected to Windows daemon bridge.` (`sess-antigravity`), and fake running `VITE v5.4.8` server (`sess-build`) | Pretends AI CLIs are authenticated and active, misstates PowerShell version (`5.1` vs `7.4`), and shows fake running dev servers | **Remove from real mode**; populate sessions strictly from `GET /api/v1/pty/sessions` |
| `src/host/terminalManager.ts` | `ensureDefaultSessions` (L68–73), `resolveShellLaunch` (L76–95) | Hardcodes title `'PowerShell 7.4'` even when spawning `powershell.exe` (Windows PowerShell 5.1), and falls back to PowerShell for `'claude'`/`'gemini'` session types | Misreports shell version and fails to launch real AI CLI binaries | **Detect actual `pwsh.exe` vs `powershell.exe` version** and route AI session types through `aiProviders.ts` |
| `src/context/RelayContext.tsx` | `INITIAL_CLI_TOOLS` (L421–475) | Hardcodes `claude` (`v1.0.8`, `installed`), `codex` (`v0.9.4`, `installed`), `gemini` (`v2.5.0`, `installed`), `antigravity` (`v1.2.0`, `installed`) | Displays fake versions instead of actual host versions (`claude 2.1.292`, `gemini 0.61.0`, `codex 0.160.0`, `agy 1.4.12`) and hides uninstalled/unauthenticated states | **Replace with live `GET /api/v1/cli/tools`** including real `authStatus` |
| `src/context/RelayContext.tsx` | `installCliTool` (L1619–1627) | `setTimeout(..., 1400)` followed by setting `status: 'installed', version: 'v1.1.0'` without calling host | Fabricates CLI installation success | **Route to `POST /api/v1/cli/install`** and refresh live catalog |

---

## 3. Swallowed Errors, Fake Optimistic Fallbacks & Mock Execution Paths

| Location | Symbol / Lines | Hardcoded / Fake Artifact | Impact | Disposition |
| :--- | :--- | :--- | :--- | :--- |
| `src/context/RelayContext.tsx` | `createFile` (L1143–1173), `createFolder` (L1204–1229) | Catches backend error into `fileError` **and still appends the new file/folder to `projects` state** | Shows non-existent files/folders in Explorer when host call 404s or fails | **Remove fake fallback mutation**; refresh from host only on confirmed HTTP 200/201 |
| `src/context/RelayContext.tsx` | `refreshFiles` (L1004) | `if (items && items.length > 0)` ignores empty arrays `[]` | Retains mock/stale files in UI when opening an empty real directory or deleting the last file | **Update state unconditionally on valid array response** (`Array.isArray(items)`) |
| `src/context/RelayContext.tsx` | `executeCommand` (L1353–1365) | Parses `cd <dir>` on frontend and overwrites `activeProject.path` | Mutates workspace root and Explorer directory when user runs `cd` in Terminal | **Remove `project.path` mutation**; update only `session.workingDir` from host response |
| `src/context/RelayContext.tsx` | `scanPcRepositories` (L1612–1616) | `await new Promise(resolve => setTimeout(resolve, 1200))` no-op | Pretends to scan PC for Git repositories while doing nothing | **Call real `POST /api/v1/workspace/scan-repos`** |
| `src/context/RelayContext.tsx` | `reconcileSingleIntent` (L1657) | Calls `executeCommandOnDaemon` (`src/utils/mockDaemon.ts`) even in real mode | Runs approved offline commands against fake regex simulator instead of Windows PC | **Execute via `adapter.terminal.executeCommand` on real host** |
| `src/screens/SourceControlScreen.tsx` | `branches` fallback (L56), `catch` blocks (L98–160) | Falls back to `['main', 'ashritha', 'deeksha', 'ashish', 'shreya']` and silently falls back to terminal strings on Git API errors | Displays nonexistent branches and hides API contract errors | **Use real `GET /api/v1/git/branches` & `GET /api/v1/git/diff`**; surface honest errors and non-Git repo empty state |
| `src/screens/PreviewScreen.tsx` & `RelayContext.tsx` | `INITIAL_DEV_SERVERS` (L247–271), `PreviewScreen.tsx` (L19–45, L145–215) | Hardcodes running Vite `:5173` & Rust `:8080` servers, fake PyTorch CUDA stdout, and fake `60 FPS DirectX 12` desktop stream | Pretends dev servers and desktop stream are running when nothing is listening | **Query live `GET /api/v1/preview/ports`** and gate desktop stream honestly (`Unavailable / Not Streaming`) |
| `src/screens/RunDebugScreen.tsx` | `RUN_CONFIGS` / launch handlers (L20–95) | Hardcodes `Cargo Run (hyper-relay)` and simulated runner commands | Launches nonexistent `cargo run` commands for fake Rust project | **Derive real run scripts from workspace `package.json` / `/api/v1/run-debug/runners`** |
| `src/utils/mockDaemon.ts` & `src/services/mockServices.ts` | Entire files | In-memory mock command simulator and mock service implementations | Acceptable **only** when `VITE_ADAPTER_MODE=mock` in isolated unit tests; must never run in default `'real'` mode | **Isolate strictly behind explicit `adapterMode === 'mock'` test flag**; ensure zero production code paths call `mockDaemon` directly |
