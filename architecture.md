# Remote Development System — Architecture & Backend Integration Guide

## 1. Executive Architecture Summary

This system implements **two distinct, backend-ready frontends** for a remote development environment:
1. **Frontend A: Mobile App (Android Client)** — Designed specifically for handheld smartphone ergonomics (`max-w-[430px]`, touch targets, persistent drawer navigation, bottom tab bar, dominant full-screen terminal, and offline intent drafting).
2. **Frontend B: Laptop App (Windows Desktop Host)** — A widescreen workstation interface (`max-w-7xl`, desktop window controls, daemon telemetry, workspace management, and synchronization review cockpit).

### Strict Boundary Separation
- **Frontend Role:** 100% of UI presentation, client-side routing, optimistic UX updates, local SQLite queue representations, terminal rendering, error states, and user interactions.
- **Backend Role (External Developer):** Native ConPTY process execution on Windows, Ed25519 cryptographic key exchange, TLS 1.3 socket tunneling, local file system operations, and git execution.
- **Integration Boundary:** Decoupled through standard TypeScript interfaces defined in `/src/services/contracts.ts` and managed via `/src/services/index.ts`. All prototype data is currently served via `MockRelayBackendAdapter` and can be switched to a real backend adapter with zero component modifications.

---

## 2. Frontend Module Structure

```
/
├── architecture.md               # Backend developer contracts, protocols, and data models
├── README.md                     # Architecture overview, folder structure, and user workflow
├── package.json                  # Frontend dependencies and build scripts
├── index.html                    # HTML entry point
├── server.js                     # Static production asset server for preview hosting
├── src/
│   ├── App.tsx                   # Master dual-frontend shell and viewport container
│   ├── main.tsx                  # React 19 entry point
│   ├── index.css                 # Tailwind CSS 4 theme and VT100 font styling
│   ├── context/
│   │   └── RelayContext.tsx      # Global UI state, reactive sessions, and adapter glue
│   ├── types/
│   │   └── relay.ts              # Domain entity models (Projects, Sessions, Files, Intents)
│   ├── services/
│   │   ├── contracts.ts          # Typed service interfaces & request/response contracts
│   │   ├── mockAdapter.ts        # Pluggable development harness implementing contracts
│   │   ├── mockDaemon.ts         # VT100 ANSI parser & CLI response simulator
│   │   └── index.ts              # Service locator and singleton adapter provider
│   ├── screens/
│   │   ├── TerminalScreen.tsx    # Dominant mobile terminal with session selector & shortcuts
│   │   ├── ExplorerScreen.tsx    # Mobile file tree, folder drilldown, text editor, file actions
│   │   ├── SourceControlScreen.tsx # Git staging, diff viewer, commits, branches, push/pull
│   │   ├── RunDebugScreen.tsx    # Task runner, debug launcher, port bindings, process monitor
│   │   ├── PreviewScreen.tsx     # Web preview (iframe), Python runner, desktop app stream
│   │   ├── OfflineQueueScreen.tsx# Draft prompts, SQLite WAL queue, cloud-mode fallback
│   │   ├── CliManagerScreen.tsx  # Claude Code, OpenAI Codex, Gemini CLI discovery & setup
│   │   ├── SettingsScreen.tsx    # Account info, PC pairing token, terminal appearance
│   │   ├── MoreScreen.tsx        # Secondary options, diagnostics, tool directory
│   │   ├── PairingScreen.tsx     # Cryptographic security hub & key management
│   │   ├── ProjectsScreen.tsx    # Multi-repo workspace list
│   │   └── LaptopApp.tsx         # Complete Windows desktop application dashboard
│   └── components/
│       ├── MobileConnectionFlow.tsx  # 3-step connection wizard (Account -> Key -> Terminal)
│       ├── NavigationDrawer.tsx      # Hamburger drawer (Flowchart requirement 3)
│       ├── BottomNavigation.tsx      # Flowchart bottom bar (Terminal, Explorer, Git, Preview, More)
│       ├── DevicePresenceBar.tsx     # Mobile header with live host telemetry & quick actions
│       ├── ReconciliationModal.tsx   # Reconnection review & confirmation modal
│       ├── ProjectSwitchDrawer.tsx   # Bottom sheet workspace switcher
│       ├── SessionDrawer.tsx         # Slide-over terminal session manager
│       ├── DeveloperAccessoryBar.tsx # Quick terminal shortcuts (Esc, Tab, Ctrl+C, arrows)
│       └── CliMissingInterceptor.tsx # Inline warning when uninstalled CLI is called
```

---

## 3. Subsystem Service Interfaces & Data Contracts

All interfaces reside in `src/services/contracts.ts`. The backend developer must implement these contracts when creating the production `RealRelayBackendAdapter`.

### Subsystem 1: Authentication (`IAuthService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `login(req: LoginRequest)` | `POST /api/v1/auth/login` | Validates email & password, issues JWT token |
| `logout()` | `POST /api/v1/auth/logout` | Revokes active session |
| `getCurrentUser()` | `GET /api/v1/auth/me` | Returns developer identity and subscription tier |
| `refreshToken()` | `POST /api/v1/auth/refresh` | Refreshes expiring session token |

#### Data Contracts:
```typescript
export interface LoginRequest {
  email: string;
  password?: string;
  authProvider?: 'password' | 'sso' | 'passkey';
}

export interface LoginResponse {
  user: UserAccount;
  authToken: string;
  tokenExpiresAt: string;
  isMockResponse: boolean;
}
```

---

### Subsystem 2: Host Connection & Pairing (`IConnectionService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `generateHostKey()` | Local IPC `Host.GeneratePairingKey` | Windows PC daemon generates random 6-digit key (e.g., `784-291`) |
| `validatePairingKey(req)` | `POST /api/v1/pairing/validate` | Validates key entered on mobile app against active host key |
| `connectToHost(req)` | WebSocket / WebRTC DataChannel | Establishes end-to-end encrypted relay tunnel |
| `disconnectHost()` | WebSocket Close Frame | Gracefully tears down connection |
| `getHostDeviceInfo()` | `GET /api/v1/host/status` | Returns host CPU, RAM, IP, port, and ping latency |
| `setHostServerStatus(status)` | Windows Service Controller API | Starts or stops the Windows background daemon |

#### Data Contracts:
```typescript
export interface ValidateKeyRequest {
  pairingKey: string;
  mobileDeviceId?: string;
}

export interface ValidateKeyResponse {
  isValid: boolean;
  targetDeviceName?: string;
  errorMessage?: string;
}
```

---

### Subsystem 3: Terminal & PTY Emulation (`ITerminalService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `listSessions()` | `GET /api/v1/pty/sessions` | Lists open ConPTY sessions on Windows host |
| `createSession(req)` | `POST /api/v1/pty/sessions` | Spawns a new PowerShell 7, CMD, bash, or AI agent process |
| `closeSession(id)` | `DELETE /api/v1/pty/sessions/:id` | Terminates process tree by PID |
| `executeCommand(req)` | WebSocket frame / ConPTY stdin | Dispatches command string to running terminal |
| `sendSignal(req)` | Windows `GenerateConsoleCtrlEvent` | Sends `SIGINT` (Ctrl+C), `SIGTERM`, or `CLEAR` |

#### Data Contracts:
```typescript
export interface ExecuteCommandRequest {
  sessionId: string;
  command: string;
  workingDir: string;
  envOverrides?: Record<string, string>;
}

export interface ExecuteCommandResponse {
  commandId: string;
  queuedOffline?: boolean;
  lines: Array<{
    type: TerminalLine['type'];
    content: string; // VT100 / ANSI escape sequences
    delay?: number;
  }>;
  exitCode?: number;
  interceptCliPrompt?: {
    toolName: string;
    cliName: string;
    installCommand: string;
  };
}
```

---

### Subsystem 4: Remote File System (`IFileSystemService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `listFiles(req)` | `GET /api/v1/fs/list?dir=...` | Lists directory contents with sizes, timestamps, and git status |
| `readFile(req)` | `GET /api/v1/fs/read?path=...` | Reads file text content for mobile viewing and editing |
| `writeFile(req)` | `POST /api/v1/fs/write` | Persists changes to disk on Windows host |
| `createFile(req)` | `POST /api/v1/fs/create` | Creates new file or text document |
| `deleteFile(req)` | `DELETE /api/v1/fs/delete` | Deletes file or directory on host |

#### Data Contracts:
```typescript
export interface ReadFileResponse {
  filePath: string;
  content: string;
  sizeBytes: number;
  encoding: 'utf-8' | 'binary';
  lastModified: string;
}

export interface WriteFileRequest {
  filePath: string;
  content: string;
  expectedVersionHash?: string;
}
```

---

### Subsystem 5: Source Control & Git (`IGitService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `getStatus(path)` | `GET /api/v1/git/status` | Runs `git status --porcelain` and parses branch/diff info |
| `stageFiles(files)` | `POST /api/v1/git/stage` | Stages selected files (`git add`) |
| `unstageFiles(files)` | `POST /api/v1/git/unstage` | Unstages files (`git restore --staged`) |
| `commit(req)` | `POST /api/v1/git/commit` | Creates commit with developer message |
| `push(branch)` | `POST /api/v1/git/push` | Pushes commits to remote upstream |
| `pull(branch)` | `POST /api/v1/git/pull` | Pulls commits from remote upstream |
| `switchBranch(branch)` | `POST /api/v1/git/checkout` | Switches branch or creates new feature branch |

---

### Subsystem 6: CLI Tooling & AI Agents (`ICliService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `listTools()` | `GET /api/v1/cli/tools` | Discovers registered tools (Claude Code, OpenAI Codex, Gemini CLI) |
| `installTool(toolId)` | `POST /api/v1/cli/install` | Runs global npm/cargo installer on Windows host |
| `checkCliStatus(name)` | `GET /api/v1/cli/check?name=...` | Checks whether executable exists in host `%PATH%` |

#### Terminal Session Groups & AI Tool Integration Architecture

The mobile Terminal session switcher supports three distinct groups:
1. **Shells (`powershell`, `cmd`, `bash`):**
   - Launched directly over Windows ConPTY using `ITerminalService.createSession`.
   - Native Windows binaries (`pwsh.exe`, `cmd.exe`, `wsl.exe`/Git `bash.exe`).
   - Availability is checked directly on the host system (defaults to `Installed`).

2. **AI Coding Tools (`claude`, `codex`, `gemini`, `antigravity`):**
   - **Claude Code (`claude`):** Integrated via `@anthropic-ai/claude-code`. Status is verified via `ICliService.checkCliStatus('claude')`. ConPTY session attaches directly to interactive AST reasoning stream.
   - **Codex CLI (`codex`):** Integrated via `@openai/codex-cli`. Status verified via `checkCliStatus('codex')`. Launches ConPTY session with code synthesis capabilities when installed.
   - **Gemini CLI (`gemini`):** Integrated via `@google/gemini-cli`. Requires developer authentication (`gemini auth login` or API key). Marked as `Needs Setup` when binary is missing or unauthenticated.
   - **Antigravity (Agent Environment / Runtime):**
     - *Backend integration remaining necessary:* Antigravity is treated separately from CLI tools because it is an autonomous agent runtime rather than a simple CLI command on `%PATH%`.
     - Direct ConPTY terminal invocation is insufficient; a dedicated Host Agent Bridge (e.g. `IAntigravityBridgeService` on IPC/WebSocket port 9872) is required to expose agent perception, goal orchestration, and workspace action channels.
     - Until this host daemon bridge is running on the Windows PC, the mobile frontend marks Antigravity as `Unavailable` and refuses to falsely report execution success.

3. **Development Sessions (`build`):**
   - Tracks active Vite/webpack development server processes (`npm run dev`) and ConPTY watcher loops with real-time process monitoring.

---

### Subsystem 7: Previews & Port Tunnels (`IPreviewService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `listDevServers()` | `GET /api/v1/preview/servers` | Lists running dev servers on localhost ports (e.g. 5173, 3000) |
| `startDevServer(cmd, port)` | `POST /api/v1/preview/servers/start` | Launches dev server process |
| `runPythonPreview(path)` | `POST /api/v1/preview/python/run` | Executes Python script and returns stdout/stderr |
| `getDesktopAppStream(appId)` | `GET /api/v1/preview/desktop/:appId` | Provides low-latency WebRTC desktop window stream |

---

### Subsystem 8: Offline Intent Queue & Sync (`ISyncService`)
| Method | Protocol / Endpoint | Description |
|---|---|---|
| `queueIntent(intent)` | Local SQLite WAL on mobile | Buffers prompt/command with sequence number & causal hash |
| `listQueuedIntents()` | Local SQLite | Reads all queued and pending intents |
| `reconcileIntent(id, action)` | `POST /api/v1/sync/reconcile-single` | Replays intent on PC after verifying git HEAD matches |
| `reconcileAll(forceRun)` | `POST /api/v1/sync/reconcile-all` | Reconciles full batch in chronological sequence |
| `triggerCloudFallback(ids)` | `POST /api/v1/sync/cloud-worker/dispatch` | Optional cloud sandbox worker execution when PC is offline |

#### Data Contracts:
```typescript
export interface CommandIntent {
  id: string;
  seq: number;
  command: string;
  workingDir: string;
  projectName: string;
  timestamp: number;
  status: 'queued' | 'dependency_blocked' | 'diverged' | 'reconciled' | 'skipped' | 'cancelled' | 'executing' | 'failed';
  causalDependencyHash: string;
  expectedBaseBranch: string;
  expectedHeadCommit: string;
  resultOutput?: string;
  executionDurationMs?: number;
}
```

---

## 4. How the Backend Developer Implements the Live Service

1. **Create the Concrete Adapter:**
   Create `/src/services/realBackendAdapter.ts`:
   ```typescript
   import { IRelayBackendAdapter, /* ...interfaces */ } from './contracts';

   export class RealRelayBackendAdapter implements IRelayBackendAdapter {
     readonly isMock = false;
     readonly adapterName = 'Native Windows Tokio Daemon';
     readonly backendEndpoint: string;

     constructor(endpointUrl: string) {
       this.backendEndpoint = endpointUrl;
       this.auth = new RealAuthService(endpointUrl);
       this.connection = new RealConnectionService(endpointUrl);
       this.terminal = new RealTerminalService(endpointUrl);
       this.fileSystem = new RealFileSystemService(endpointUrl);
       this.git = new RealGitService(endpointUrl);
       this.cli = new RealCliService(endpointUrl);
       this.preview = new RealPreviewService(endpointUrl);
       this.sync = new RealSyncService(endpointUrl);
     }
     // ...
   }
   ```

2. **Plug It In:**
   In `/src/services/index.ts`:
   ```typescript
   import { RealRelayBackendAdapter } from './realBackendAdapter';

   // Replace the MockRelayBackendAdapter instance with your live adapter:
   let activeAdapter: IRelayBackendAdapter = new RealRelayBackendAdapter('wss://192.168.1.142:9871');
   ```

3. **No UI Changes Required:**
   All 12 screens and 9 components consume services exclusively through `useRelay()` and `getBackendAdapter()`. The entire UI will seamlessly route to your real backend endpoints.
