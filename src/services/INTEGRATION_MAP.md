# Integration Map — Deeksha D1 Audit

> Every UI operation → contract method → current behavior → required real behavior → error state.

## 1. Authentication (`IAuthService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| Login form submit | `login(req)` | Fake delay, always succeeds | POST to PC host `/api/v1/auth/login` | Show error message, stay on login |
| Logout button | `logout()` | Sets `isLoggedIn=false` in memory | POST to host, clear session token | Show error, allow retry |
| Get current user | `getCurrentUser()` | Returns hardcoded user | GET from host `/api/v1/auth/me` | Show stale cached user or login prompt |
| Token refresh | `refreshToken()` | Returns fake token | POST to host `/api/v1/auth/refresh` | Redirect to login |

**Notes:** Auth in the current mock is entirely client-side. For LAN-first MVP, pairing replaces cloud auth. The `IAuthService` contract exists but pairing flow (`IConnectionService`) is the real gatekeeper.

## 2. Connection & Pairing (`IConnectionService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| Generate pairing key (PC side) | `generateHostKey()` | Random 6-digit, client-side | PC daemon IPC generates fresh secret | PC unreachable indicator |
| Validate key (mobile entry) | `validatePairingKey(req)` | String compare in browser | POST to PC `/api/v1/pairing/validate` | "Invalid key" error message |
| Connect to host | `connectToHost(req)` | Fake success after validate | WebSocket/REST to establish tunnel | Connection error, retry prompt |
| Disconnect | `disconnectHost()` | Sets tunnel status idle | Close WebSocket, tear down session | Already disconnected, no-op |
| Get host device info | `getHostDeviceInfo()` | Returns hardcoded DeviceInfo | GET `/api/v1/host/status` | Show last-known info as stale |
| Toggle server status | `setHostServerStatus(s)` | Toggles in-memory state | Windows Service Controller IPC | "Cannot reach PC" error |

**Notes:** `RelayContext.tsx` currently handles pairing entirely with in-memory state (`connectWithKey`, `regenerateConnectionKey`). The real adapter must make network calls to the PC. Key validation on mobile → PC host is the critical path.

## 3. Terminal & PTY (`ITerminalService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| List sessions | `listSessions()` | Returns empty array | GET `/api/v1/pty/sessions` | Show empty + PC offline warning |
| New terminal session | `createSession(req)` | Creates local object | POST `/api/v1/pty/sessions` | "Cannot spawn, PC offline" |
| Close session | `closeSession(id)` | No-op | DELETE `/api/v1/pty/sessions/:id` | "Session not found" |
| Execute command | `executeCommand(req)` | `mockDaemon` simulation | WebSocket frame to ConPTY stdin | Offline → queue intent; error → show error line |
| Send signal (Ctrl+C) | `sendSignal(req)` | No-op | POST `/api/v1/pty/sessions/:id/signal` | "Signal failed" system line |

**Notes:** `RelayContext.tsx` `executeCommand` directly calls `executeCommandOnDaemon()` from `mockDaemon.ts`. The real path must route through the adapter's `terminal.executeCommand()`. Offline commands are already buffered as intents — this is correct behavior to preserve.

## 4. File System (`IFileSystemService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| Browse files | `listFiles(req)` | Returns empty array; uses hardcoded `INITIAL_PROJECTS` | GET `/api/v1/fs/list` | Show last-cached tree as stale |
| Read file content | `readFile(req)` | Returns mock string | GET `/api/v1/fs/read` | "File not accessible" |
| Save file | `writeFile(req)` | Returns fake success | POST `/api/v1/fs/write` | Conflict detection (hash mismatch) |
| Create file | `createFile(req)` | Returns mock ProjectFile | POST `/api/v1/fs/create` | "Create failed" |
| Delete file | `deleteFile(req)` | No-op | DELETE `/api/v1/fs/delete` | Confirmation required, "delete failed" |

**Notes:** `RelayContext` manages files entirely in React state from hardcoded `INITIAL_PROJECTS`. Real adapter must fetch from PC. The `saveFileContent` function in context edits local state — needs to also call `fileSystem.writeFile()` via adapter.

## 5. Source Control / Git (`IGitService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| Get status | `getStatus(path)` | Returns hardcoded dirty status | GET `/api/v1/git/status` | "Git unavailable" |
| Stage files | `stageFiles(files)` | No-op | POST `/api/v1/git/stage` | "Stage failed" |
| Unstage files | `unstageFiles(files)` | No-op | POST `/api/v1/git/unstage` | "Unstage failed" |
| Commit | `commit(req)` | Returns random hash | POST `/api/v1/git/commit` | "Commit failed" with message |
| Push | `push(branch)` | Fake delay + success | POST `/api/v1/git/push` | "Push failed" with output |
| Pull | `pull(branch)` | Fake "up to date" | POST `/api/v1/git/pull` | "Pull failed" / merge conflict |
| Switch branch | `switchBranch(name)` | No-op | POST `/api/v1/git/checkout` | "Switch failed" |

**Notes:** Git operations are security-sensitive. Destructive operations (force push, branch delete) must require confirmation. The real adapter must send these to the PC host.

## 6. CLI Tooling & AI Agents (`ICliService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| List installed tools | `listTools()` | Returns empty array; uses hardcoded `INITIAL_CLI_TOOLS` | GET `/api/v1/cli/tools` | Show last-known list as stale |
| Install tool | `installTool(id)` | Fake delay + success | POST `/api/v1/cli/install` (long-running) | "Install failed" with log |
| Check CLI status | `checkCliStatus(name)` | Hardcoded claude/codex=installed | GET `/api/v1/cli/check` | "Cannot check, PC offline" |

**Notes:** Antigravity requires a dedicated daemon bridge (port 9872), not a simple CLI check. Mark as `unavailable` until that bridge exists.

## 7. Preview & Tunnels (`IPreviewService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| List dev servers | `listDevServers()` | Returns empty array; uses hardcoded `INITIAL_DEV_SERVERS` | GET `/api/v1/preview/servers` | "No servers detected" |
| Start dev server | `startDevServer(cmd, port)` | Returns fake server object | POST `/api/v1/preview/servers/start` | "Start failed" |
| Stop dev server | `stopDevServer(id)` | No-op | POST `/api/v1/preview/servers/stop` | "Stop failed" |
| Run Python preview | `runPythonPreview(path)` | Returns fake output | POST `/api/v1/preview/python/run` | "Python not available" |
| Desktop app stream | `getDesktopAppStream(id)` | Returns fake WebRTC info | GET `/api/v1/preview/desktop/:id` | "Stream unavailable" |

## 8. Offline Sync & Reconciliation (`ISyncService`)

| UI Operation | Contract Method | Current (Mock) | Required (Real) | Error State |
|---|---|---|---|---|
| Queue intent | `queueIntent(intent)` | Appends to in-memory array | Local IndexedDB persistence | "Queue full" / storage error |
| List queued intents | `listQueuedIntents()` | Returns in-memory queue | Read from IndexedDB | Empty state |
| Reconcile single | `reconcileIntent(id, action)` | Fake delay + mock run | POST `/api/v1/sync/reconcile-single` | "Reconcile failed" / diverged |
| Reconcile all | `reconcileAll(force)` | Loops mock reconcile | POST `/api/v1/sync/reconcile-all` | Partial failure report |
| Cloud fallback | `triggerCloudFallback(ids)` | Fake cloud response | **DEFERRED** — not in MVP | "Cloud mode disabled" |

**Notes:** Current `RelayContext.tsx` manages intents in React state (`useState`). This is lost on page refresh. Real implementation needs IndexedDB persistence. The reconciliation modal already exists and requires explicit user approval — this is correct.

## Key Architectural Observations

1. **RelayContext.tsx is the main consumer** — it manages all state and calls `mockDaemon` directly, not through the adapter's `ITerminalService`. The adapter (`mockAdapter.ts`) exists but is largely unused by the context.
2. **Adapter pattern is ready** — `getBackendAdapter()` / `setBackendAdapter()` in `index.ts` supports hot-swapping.
3. **No network calls exist yet** — everything is in-memory simulation.
4. **Offline intent buffering works correctly** in concept but is not persistent (lost on refresh).
5. **Reconciliation modal requires explicit approval** — correct behavior, must be preserved.
6. **Cloud fallback is explicitly deferred** — `triggerCloudFallback` should return "disabled" state.

## Contract Gaps (None Requiring Changes)

The existing `contracts.ts` and `relay.ts` types are sufficient for the real adapter. No shared contract changes needed for D2.
