# Lazy Terminal — Backend & End-to-End Root Cause Audit

**Generated:** Phase 1 Baseline Audit (Verified against repository commit `2cde337` on Windows 11)

---

## Executive Summary

Lazy Terminal currently splits host duties across **three incompatible entry points** (`lazy_terminal_companion.py`, `src/host/companionServer.ts` / `server.ts`, and `server.js`) while keeping production UI state seeded with fabricated mock projects (`C:\Projects\hyper-relay`), fabricated terminal transcripts, fabricated CLI tool versions, and silent backend path aliasing. When the user runs the documented Windows companion (`npm run companion` -> `lazy_terminal_companion.py` on port `3000`) and pairs from mobile/web, pairing succeeds against the Python HTTP stub, and every subsequent terminal, filesystem, Git, and CLI request fails with HTTP `404` (`Endpoint /api/v1/pty/sessions/sess-pwsh/input not found`, `Endpoint /api/v1/pty/sessions/sess-claude/input not found`, `Endpoint /api/v1/fs/list not found`).

Below is the complete, code-proven root cause breakdown of all backend, transport, security, workspace, terminal, and AI CLI defects.

---

## Issue 1 — Split Host Entry Points & Missing `/api/v1/*` Routes on Default Companion (`CRITICAL`)

1. **Issue name and severity:** Companion Server Fragmentation & HTTP 404 on Terminal / Filesystem / CLI Endpoints (`CRITICAL`)
2. **File(s), function(s), and call path:**
   - `lazy_terminal_companion.py` -> `CompanionRequestHandler.do_GET` (lines 118–154) and `CompanionRequestHandler.do_POST` (lines 156–236)
   - `package.json` -> `"companion": "python lazy_terminal_companion.py"`, `"start": "node server.js"`, `"host": "npx tsx src/host/companionServer.ts"`
   - `server.js` (lines 1–32)
   - `server.ts` -> `startServer()` (lines 15–62)
   - `src/host/companionServer.ts` -> `startHostCompanionServer()` (lines 20–78)
   - `src/services/config.ts` -> `getDefaultConfig()` (lines 24–54)
   - `src/services/realAdapter.ts` -> `RealTerminalService.executeCommand`, `RealFileSystemService.listDirectory`
3. **Observed behavior:**
   - Pairing succeeds via `GET /api/v1/pairing/key` and `POST /api/v1/tunnel/connect` when `lazy_terminal_companion.py` runs on `:3000`.
   - Running `ls` in PowerShell session `sess-pwsh` displays: `Endpoint /api/v1/pty/sessions/sess-pwsh/input not found`.
   - Sending a prompt in Claude session `sess-claude` displays: `Endpoint /api/v1/pty/sessions/sess-claude/input not found`.
   - Opening the Explorer tab displays: `Endpoint /api/v1/fs/list not found` alongside hardcoded Rust mock files (`src`, `Cargo.toml`, `notes.txt`).
   - Running `npm start` (`server.js`) serves static HTML on unknown `GET /api/v1/*` routes and Express 404 on `POST /api/v1/*`.
4. **Root cause:**
   - `lazy_terminal_companion.py` implements an isolated Python `ThreadingHTTPServer` on `0.0.0.0:3000` that handles **only** `/health`, `/api/v1/host/status`, `/api/v1/pairing/*`, `/api/v1/tunnel/*`, and `/api/v1/sync/run`. Line 235 explicitly returns `self._send_json({"error": f"Endpoint {parsed.path} not found"}, status=404)` for all POST routes, and line 153 returns `{"error": f"Endpoint {parsed.path} not found on host"}` (404) for all GET routes.
   - Meanwhile, the real Express routers live in `src/host/router.ts`, `src/server/fsRoutes.ts`, `src/server/gitRoutes.ts`, and `src/server/shreyaRouter.ts`, which are only partially wired in `server.ts` (`:3000`) and `src/host/companionServer.ts` (`127.0.0.1:9871`). Even in `src/host/companionServer.ts`, `hostBind` defaults to `127.0.0.1` (`src/host/config.ts:52`), blocking LAN phones and Android Emulators (`10.0.2.2`).
5. **Expected/correct behavior:**
   - Every documented host startup mode (`npm run host`, `npm run dev:full`, `npm run companion`, and `server.ts`) must expose the **same unified, authenticated `/api/v1/*` API contract** bound on `0.0.0.0` (configurable via `LAZY_TERMINAL_HOST_BIND`) so local browser, LAN Android devices, and Android Emulator (`10.0.2.2`) reach all real endpoints.
6. **Proposed repair:**
   - Consolidate all Express API routes (`/api/v1/workspace`, `/api/v1/fs`, `/api/v1/git`, `/api/v1/cli`, `/api/v1/run-debug`, `/api/v1/preview`, `/api/v1/pty`, `/api/v1/pairing`, `/api/v1/tunnel`, `/api/v1/host`) inside `createHostCompanion()` (`src/host/router.ts` & `src/host/companionServer.ts`).
   - Update `server.ts` to mount `createHostCompanion()` cleanly alongside static `dist/` / Vite middleware.
   - Update `lazy_terminal_companion.py` to launch and manage the real Node/TS host companion backend process (or proxy all HTTP requests directly to it while synchronizing the pairing UI window) instead of running a disconnected stub HTTP server.
7. **Regression test to add:**
   - Integration & Playwright E2E test verifying `/health`, `/api/v1/pairing/key`, `/api/v1/tunnel/connect`, `/api/v1/workspace`, `/api/v1/fs/list`, `/api/v1/pty/sessions`, and `/api/v1/cli/tools` all return live responses with zero 404s on both Node host and Python companion startup paths.

---

## Issue 2 — Unauthenticated Filesystem, Git, CLI, and Preview Endpoints (`CRITICAL` Security Defect)

1. **Issue name and severity:** Missing Session Token Enforcement on `/api/v1/fs`, `/api/v1/git`, `/api/v1/cli`, `/api/v1/run-debug`, and `/api/v1/preview` (`CRITICAL`)
2. **File(s), function(s), and call path:**
   - `src/host/companionServer.ts` (lines 42–48)
   - `server.ts` (lines 28–33)
   - `src/host/router.ts` -> `requireSessionAuth` (lines 38–54)
3. **Observed behavior:**
   - In both `companionServer.ts` and `server.ts`, `app.use('/api/v1/fs', fsRouter)`, `app.use('/api/v1/git', gitRouter)`, and `app.use('/api/v1', shreyaRouter)` are mounted **before** `companion.router` without `requireSessionAuth`. Any unauthenticated LAN client can read/write/delete files, run Git commands, or invoke CLI inspection/launch without pairing.
4. **Root cause:**
   - `requireSessionAuth` was defined locally inside `createHostCompanion` (`src/host/router.ts`) and applied only to `/api/v1/host/*`, `/api/v1/tunnel/disconnect`, and `/api/v1/pty/*`, leaving sibling routers unprotected when mounted at the top-level Express app.
5. **Expected/correct behavior:**
   - Only `/health`, `GET /api/v1/pairing/key` (loopback-only or local host display), `POST /api/v1/pairing/validate`, and `POST /api/v1/tunnel/connect` are accessible prior to session establishment. Every workspace, filesystem, Git, terminal, CLI, run-debug, and preview route must require a valid `Authorization: Bearer <sessionToken>` (or authenticated SSE token query param for `EventSource` where headers are unsupported).
6. **Proposed repair:**
   - Mount `workspaceRouter`, `fsRouter`, `gitRouter`, and `shreyaRouter` behind `requireSessionAuth` inside `createHostCompanion` (`src/host/router.ts`), and restrict `GET /api/v1/pairing/key` / `POST /api/v1/pairing/generate` to loopback (`127.0.0.1` / `::1`) unless already authenticated.
7. **Regression test to add:**
   - Security test asserting HTTP `401 AUTH_REQUIRED` on unauthenticated calls to `/api/v1/fs/list`, `/api/v1/fs/write`, `/api/v1/git/status`, `/api/v1/workspace`, `/api/v1/cli/tools`, and `/api/v1/pty/sessions`.

---

## Issue 3 — Hardcoded `C:\Projects\hyper-relay` Workspace, Silent Aliasing, and Conflated Path State (`CRITICAL`)

1. **Issue name and severity:** Mandatory Hardcoded `C:\Projects\hyper-relay` Path, Silent Backend Path Substitution, and Terminal-Explorer Path Conflation (`CRITICAL`)
2. **File(s), function(s), and call path:**
   - `src/context/RelayContext.tsx` -> `INITIAL_PROJECTS` (lines 71–244), `activeProjectId` default `'hyper-relay'` (line 532), `executeCommand` `cd` handler (lines 1353–1365)
   - `src/host/config.ts` -> `FRONTEND_DEMO_PATHS` (lines 19–25) and `resolveRequestedWorkingDir` (lines 78–86)
   - `src/server/fsSecurity.ts` -> `DEMO_PROJECT_ROOTS` (lines 20–24) and `normalizeProjectRoot` (lines 26–33)
   - `src/screens/TerminalScreen.tsx` -> prompt rendering `{activeProject.path}>` (lines 163, 204)
3. **Observed behavior:**
   - App always boots into `C:\Projects\hyper-relay` with fake Rust files (`src/relay_daemon.rs`, `Cargo.toml`, `notes.txt`).
   - Backend silently rewrites requests for `C:\Projects\hyper-relay` to `process.cwd()`, hiding missing-directory errors while the UI still displays `C:\Projects\hyper-relay>`.
   - Running `cd ..` in a terminal mutates `activeProject.path` in `RelayContext.tsx` (line 1360), unexpectedly changing Explorer's root folder and every other session's displayed prompt!
   - Users have no real host folder browser or workspace selector to choose a real directory on their Windows PC.
4. **Root cause:**
   - `INITIAL_PROJECTS` is hardcoded in `RelayContext.tsx`; no `/api/v1/workspace` endpoints exist on the host; `DEMO_PROJECT_ROOTS` / `FRONTEND_DEMO_PATHS` mask invalid hardcoded roots; and `RelayContext` overwrites `project.path` when parsing `cd` in terminal commands instead of updating `session.workingDir`.
5. **Expected/correct behavior:**
   - No mandatory `C:\Projects\hyper-relay` path in production; missing or inaccessible paths fail explicitly with actionable errors instead of silent substitution.
   - Users can browse real Windows drives/folders or trigger native Windows folder selection, validate and switch workspaces, persist recent workspaces, and keep **five distinct path states**: (1) selected workspace root, (2) Explorer current directory, (3) each terminal session's `workingDir`, (4) AI CLI launch `workingDir`, and (5) discovered Git repository root.
6. **Proposed repair:**
   - Remove `FRONTEND_DEMO_PATHS` and `DEMO_PROJECT_ROOTS` silent substitution.
   - Create `WorkspaceManager` + `/api/v1/workspace` routes (`GET /`, `GET /browse`, `POST /select`, `POST /pick-native`, `POST /scan-repos`) managing authorized workspace roots dynamically across FS, Git, Terminal, and CLI subsystems.
   - Update `RelayContext.tsx`, `ProjectSwitchDrawer.tsx`, `ProjectsScreen.tsx`, `ExplorerScreen.tsx`, and `TerminalScreen.tsx` to load real workspaces, browse/select real Windows folders, and keep `session.workingDir` independent from `activeProject.path` and Explorer's `currentDirStack`.
7. **Regression test to add:**
   - E2E and API tests proving: selecting two distinct temp Windows folders updates Explorer & new terminals; `C:\Projects\hyper-relay` (when absent on disk) returns 404/error without substituting `process.cwd()`; and `cd ..` in Terminal updates `session.workingDir` without altering Explorer's current directory.

---

## Issue 4 — Broken Explorer Operations, Ignored Empty Folders, Missing Rename, and Fake Optimistic Mutations (`HIGH`)

1. **Issue name and severity:** Explorer Swallows Backend Failures, Refuses Empty Directories, Ignores Subdirectories on Create, and Lacks Rename (`HIGH`)
2. **File(s), function(s), and call path:**
   - `src/context/RelayContext.tsx` -> `refreshFiles` (lines 997–1025), `loadFileContent` (lines 1037–1069), `saveFileContent` (lines 1072–1113), `createFile` (lines 1116–1177), `createFolder` (lines 1179–1233), `deleteProjectFile` (lines 1235–1266)
   - `src/screens/ExplorerScreen.tsx` (lines 38–125)
   - `src/server/fsRoutes.ts` (missing `/rename` and `/stat`; `read`/`write`/`delete` missing `projectPath` propagation from `RelayContext`)
3. **Observed behavior:**
   - Opening an empty folder or deleting the last file in a folder leaves old/mock files visible in Explorer.
   - Creating a file/folder inside a subfolder creates it in `activeProject.path` root instead of `currentSubDir`.
   - Even when `/api/v1/fs/create` fails (e.g., 404/403), `createFile` and `createFolder` catch the error and **still append the fake file/folder into React state**!
   - `loadFileContent`, `saveFileContent`, and `deleteProjectFile` omit `projectPath`, causing `fsRoutes.ts` to resolve paths against `process.cwd()` instead of the active workspace.
   - No file/folder rename endpoint or UI action exists; folders cannot be deleted in Explorer.
4. **Root cause:**
   - `RelayContext.tsx:1004` checks `if (items && items.length > 0)` before updating state, discarding `[]` on empty directories!
   - `createFile`/`createFolder` run state mutation outside the `try` block even when `adapter.fileSystem.createFile` throws.
   - `fsRoutes.ts` lacks `POST /api/v1/fs/rename` and `GET /api/v1/fs/stat`.
5. **Expected/correct behavior:**
   - Explorer reflects real Windows disk contents at all times (including `0 items` empty folders), passes `projectPath` + `currentSubDir` on all operations, supports create/read/write/rename/delete for files and folders, caps huge directory listings safely, and never mutates UI state when the host operation fails.
6. **Proposed repair:**
   - Add `POST /api/v1/fs/rename`, `GET /api/v1/fs/stat`, recursive/safe directory delete option, and entry pagination/limit in `src/server/fsRoutes.ts`.
   - Fix `realAdapter.ts`, `RelayContext.tsx`, and `ExplorerScreen.tsx` to pass `projectPath` and `subDir`, accept empty arrays `[]`, remove fake optimistic fallbacks, and add inline Rename, Folder Delete, and Refresh controls in `ExplorerScreen.tsx`.
7. **Regression test to add:**
   - Playwright E2E Scenario C verifying create folder, create file, edit/save file, rename file, delete file, empty folder state, and host-created file visibility after refresh against `fs.existsSync`/`fs.readFileSync` on Windows disk.

---

## Issue 5 — Non-Streaming PowerShell Execution, `-NonInteractive` Flag, and Swallowed Errors (`HIGH`)

1. **Issue name and severity:** PowerShell Spawned `-NonInteractive` Without Live Frontend SSE Subscription, Resize/Status Endpoints, or Clean Error Unwrapping (`HIGH`)
2. **File(s), function(s), and call path:**
   - `src/host/terminalManager.ts` -> `resolveShellLaunch` (lines 76–95), `ensureProcess` (lines 310–425), `sendSignal` (lines 256–295)
   - `src/host/router.ts` (lines 118–218)
   - `src/services/apiClient.ts` (lines 115–126)
   - `src/context/RelayContext.tsx` -> `INITIAL_SESSIONS` (lines 274–418), `executeCommand` (lines 1300–1450)
   - `src/screens/TerminalScreen.tsx` (line 138 filtering `line.type === 'system'`)
3. **Observed behavior:**
   - `INITIAL_SESSIONS` displays fake `"PowerShell 7.4"` (even when `pwsh.exe` is absent and `powershell.exe` 5.1 is used) and fake Vite/Claude/Gemini histories.
   - Long-running commands produce zero incremental lines in the UI until command completion or 30s timeout because `RelayContext.tsx` never subscribes to `GET /api/v1/pty/sessions/:id/stream`.
   - Sending `SIGINT` kills the entire PowerShell child process (`killProcessTree`), destroying session variables and resetting state unless cwd is preserved.
   - `apiClient.ts` formats `{ error: { code, message } }` as `[object Object]` because `if (parsed.error) errorMessage = parsed.error` assigns an object to a string variable.
   - `TerminalScreen.tsx` hides all `type === 'system'` lines, swallowing security guard and signal feedback.
4. **Root cause:**
   - `terminalManager.ts` launches `powershell.exe -NoLogo -NoProfile -NonInteractive -Command -`; lacks UTF-8 input/output encoding initialization in the persistent shell bootstrap (only setting OutputEncoding per command); lacks `GET /api/v1/pty/sessions/:id` and `POST /api/v1/pty/sessions/:id/resize`; and `RelayContext.tsx` relies strictly on request/response polling instead of SSE streaming.
5. **Expected/correct behavior:**
   - Real persistent Windows PowerShell (`pwsh.exe` if available, else `powershell.exe` with accurate version/shell name), UTF-8 stdin/stdout/stderr for Unicode paths & output, live SSE output streaming during long-running commands, `cd` persistence across commands, clean Ctrl+C (`SIGINT`) recovery preserving `workingDir`, multi-session isolation, and real session lifecycle (`list`, `create`, `get status`, `input`, `stream`, `signal`, `resize`, `delete`).
6. **Proposed repair:**
   - Upgrade `terminalManager.ts` with accurate shell detection (`pwsh` vs `powershell`), UTF-8 bootstrap, continuous SSE line streaming (`output` + `session` events), `getSession` and `resizeSession`, cwd-preserving `SIGINT` recovery, and allowed-root dynamic updates from `WorkspaceManager`.
   - Wire SSE streaming in `RelayContext.tsx`, remove fake `INITIAL_SESSIONS` transcripts, fix `apiClient.ts` object error extraction, and render actionable system/signal lines in `TerminalScreen.tsx`.
7. **Regression test to add:**
   - Playwright E2E Scenario D covering `pwd`, `cd ..`, `ls`, `Get-ChildItem`, `mkdir`, `New-Item`, `Get-Content`, `echo`, `whoami`, `Get-Location`, spaces & Unicode filenames, multi-line loop + Ctrl+C interrupt, non-zero exit codes, two isolated PowerShell sessions, and session close/recreate.

---

## Issue 6 — Disconnected AI CLI Integrations & Fabricated Claude / Gemini / Codex / Antigravity Sessions (`HIGH`)

1. **Issue name and severity:** Fake AI CLI Sessions, Unwired `/api/v1/cli/tools`, and Missing Interactive/Session CLI Provider Adapters (`HIGH`)
2. **File(s), function(s), and call path:**
   - `src/context/RelayContext.tsx` -> `INITIAL_SESSIONS` (`sess-claude`, `sess-gemini`, `sess-antigravity` lines 296–395), `INITIAL_CLI_TOOLS` (lines 421–475), `installCliTool` (lines 1619–1627)
   - `src/host/terminalManager.ts` -> `resolveShellLaunch` (lines 76–95 — ignores `'claude'`, `'gemini'`, `'codex'`, `'antigravity'` session types and spawns plain PowerShell!)
   - `src/services/cliDetector.ts` (lines 44–138, 280–395)
   - `src/screens/CliManagerScreen.tsx` & `src/components/SessionDrawer.tsx`
3. **Observed behavior:**
   - UI shows `[Claude Code v1.0.8] Attached to persistent session... ✔ Project indexed: 7 files parsed`, `[Gemini CLI v2.5.0] Ready. Authenticated with Google Cloud Project.`, and `[Antigravity Agent Runtime v1.2.0]` even when completely disconnected from the host!
   - Meanwhile, on this actual Windows PC:
     - `claude.exe` is installed at `C:\Users\Ashish Dasiga\.local\bin\claude.exe` (`2.1.292 (Claude Code)`, logged in via `oauth_token`)
     - `gemini.cmd` is installed at `C:\Users\Ashish Dasiga\AppData\Roaming\npm\gemini.cmd` (`0.61.0`)
     - `codex.cmd` is installed at `C:\Users\Ashish Dasiga\AppData\Roaming\npm\codex.cmd` (`codex-cli 0.160.0`, logged in via ChatGPT)
     - `agy.exe` is installed at `C:\Users\Ashish Dasiga\AppData\Local\agy\bin\agy.exe` (`1.4.12`)
   - Sending input in `sess-claude` or `sess-gemini` either 404s (against Python companion) or runs raw PowerShell instead of invoking `claude` or `gemini`!
   - `installCliTool` in `RelayContext.tsx` sleeps `1400ms` and fabricates `version: 'v1.1.0'`.
4. **Root cause:**
   - `RelayContext` never calls `adapter.cli.listTools()`, `terminalManager.ts` has no AI CLI session runner, and `cliDetector.ts` only performs one-shot `--version` or raw single-shot spawn without multi-turn session IDs, auth-state probing, or `.cmd` safe argument handling via Node/executable resolution.
5. **Expected/correct behavior:**
   - Host discovers real executables, versions, paths, and authentication readiness (`claude auth status`, `codex login status`, Gemini config/auth check, `agy --version`).
   - Creating or sending prompts to a `claude`, `gemini`, `codex`, or `antigravity` session invokes a dedicated provider adapter in the active Windows workspace directory (`cwd`), maintains multi-turn session continuity (`claude -p --session-id/--resume --output-format stream-json --verbose`, `gemini -p --resume --output-format stream-json`, `codex exec`, `agy -p`), streams real stdout/stderr chunks over SSE, supports `SIGINT` cancellation, and surfaces real unauthenticated/login errors verbatim without faking responses.
6. **Proposed repair:**
   - Create `src/host/aiProviders.ts` implementing clean per-provider adapters (`claude`, `gemini`, `codex`, `antigravity`) with executable discovery, auth status probing, safe argument execution (no shell string concatenation), streaming output parsing, session continuity, and process-tree cancellation.
   - Integrate `aiProviders` into `terminalManager.ts` (for `claude` / `gemini` / `codex` / `antigravity` session types) and `/api/v1/cli/*` routes.
   - Replace `INITIAL_CLI_TOOLS` and fake AI `INITIAL_SESSIONS` in `RelayContext.tsx` with live `/api/v1/cli/tools` and real on-demand agent sessions.
7. **Regression test to add:**
   - Playwright E2E Scenario E + integration tests verifying real CLI discovery, real versions (`2.1.292`, `0.61.0`, `0.160.0`, `1.4.12`), missing-binary error handling, and real prompt execution in a disposable test directory.

---

## Issue 7 — Git, Offline Queue, and Preview Adapter Contract Mismatches (`MEDIUM`)

1. **Issue name and severity:** Git Payload Mismatches, Offline Queue Mock Execution, and Preview Endpoint Mismatches (`MEDIUM`)
2. **File(s), function(s), and call path:**
   - `src/services/realAdapter.ts` -> `RealGitService` (lines 197–238), `RealPreviewService` (lines 286–306)
   - `src/screens/SourceControlScreen.tsx` (lines 51–168)
   - `src/server/gitRoutes.ts` (lines 118–260)
   - `src/server/shreyaRouter.ts` (lines 139–175)
   - `src/context/RelayContext.tsx` -> `INITIAL_INTENTS` (lines 477–516), `reconcileSingleIntent` (line 1657 calling `executeCommandOnDaemon`), `scanPcRepositories` (lines 1612–1616)
3. **Observed behavior:**
   - `SourceControlScreen` passes `activeProject.path` to `stageFiles(files, path)`, `unstageFiles(files, path)`, `push(branch, path)`, `pull(branch, path)`, which `RealGitService` drops, causing Git mutations to target `process.cwd()` instead of the selected workspace.
   - `RealGitService.switchBranch` sends `{ branch }` whereas `POST /api/v1/git/checkout` requires `{ projectPath, branchName, createNew }`, causing HTTP 400.
   - `SourceControlScreen` falls back to hardcoded contributor branches `['main', 'ashritha', 'deeksha', 'ashish', 'shreya']` because `RealGitService` omits `getBranches` and `getDiff`.
   - `INITIAL_INTENTS` seeds 3 fake `C:\Projects\hyper-relay` offline intents into IndexedDB on first load, and approving a queued intent executes it against the **mock** `executeCommandOnDaemon` instead of the real host terminal!
   - `RealPreviewService.getDesktopPreviewInfo` calls `/api/v1/preview/desktop/${appId}` while `shreyaRouter.ts` defines `/api/v1/preview/desktop-stream?appId=...`.
4. **Root cause:**
   - `RealGitService` and `RealPreviewService` were written against an earlier draft of `contracts.ts` without matching `gitRoutes.ts` and `shreyaRouter.ts`, and `RelayContext.tsx` left mock helpers wired into offline queue reconciliation and repo scanning.
5. **Expected/correct behavior:**
   - All Git operations pass `projectPath` and match `gitRoutes.ts` schemas; branches and diffs come strictly from the real repo (or clean "Not a git repository" state when the selected workspace has no `.git`); offline queue starts empty (zero fake intents) and executes approved intents via the real host adapter; `scanPcRepositories` scans real Windows workspace parent directories.
6. **Proposed repair:**
   - Align `contracts.ts`, `realAdapter.ts`, `SourceControlScreen.tsx`, `PreviewScreen.tsx`, and `RelayContext.tsx` with the live backend routes; remove `INITIAL_INTENTS`, fake branches, fake `scanPcRepositories` sleep, and `executeCommandOnDaemon` fallback in real mode.
7. **Regression test to add:**
   - API & Playwright checks verifying Git status/branches/stage/commit in a disposable temp Git repo, clean non-Git workspace handling, and zero fake offline intents on connect.
