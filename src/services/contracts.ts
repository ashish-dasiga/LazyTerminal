import { 
  CommandIntent, 
  DeviceInfo, 
  DevServer, 
  Project, 
  ProjectFile, 
  TerminalLine, 
  TerminalSession, 
  UserAccount,
  AiCliTool 
} from '../types/relay';

// ============================================================================
// 1. AUTHENTICATION SERVICE CONTRACTS
// ============================================================================

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

export interface RefreshTokenResponse {
  authToken: string;
  tokenExpiresAt: string;
}

/**
 * Service contract for User Authentication and Session Identity.
 * Real backend developers must implement this interface backed by the user auth service.
 */
export interface IAuthService {
  /**
   * Authenticate user credentials.
   * @endpoint POST /api/v1/auth/login
   * @transport HTTPS REST
   */
  login(req: LoginRequest): Promise<LoginResponse>;

  /**
   * Invalidate current user session token.
   * @endpoint POST /api/v1/auth/logout
   * @transport HTTPS REST
   */
  logout(): Promise<void>;

  /**
   * Retrieve currently authenticated user profile.
   * @endpoint GET /api/v1/auth/me
   * @transport HTTPS REST
   */
  getCurrentUser(): Promise<UserAccount>;

  /**
   * Refresh expiring session token.
   * @endpoint POST /api/v1/auth/refresh
   * @transport HTTPS REST
   */
  refreshToken(): Promise<RefreshTokenResponse>;
}

// ============================================================================
// 2. CONNECTION & PAIRING SERVICE CONTRACTS
// ============================================================================

export interface GenerateKeyResponse {
  pairingKey: string; // e.g. "784-291"
  expiresInSeconds: number;
  qrPayload: string;
}

export interface ValidateKeyRequest {
  pairingKey: string;
  mobileDeviceId?: string;
}

export interface ValidateKeyResponse {
  isValid: boolean;
  targetDeviceName?: string;
  errorMessage?: string;
}

export interface ConnectHostRequest {
  pairingKey: string;
  ed25519ClientPublicKey?: string;
}

export interface ConnectHostResponse {
  success: boolean;
  device: DeviceInfo;
  sessionToken: string;
  errorMessage?: string;
}

export interface HostServerStatusResponse {
  status: 'running' | 'stopped' | 'starting';
  activePortBindings: number[];
  cpuUsagePercent: number;
  memoryUsageMb: number;
}

/**
 * Service contract for Windows PC Pairing and Tunnel Connection.
 * Real backend developers must implement this over the host daemon's discovery & auth port.
 */
export interface IConnectionService {
  /**
   * Generates a 6-digit cryptographic pairing key on the Windows PC application.
   * @endpoint RPC Host.GeneratePairingKey
   * @transport Local IPC / Daemon API
   */
  generateHostKey(): Promise<GenerateKeyResponse>;

  /**
   * Fetches the active 6-digit cryptographic pairing key from the Windows PC companion.
   * @endpoint GET /api/v1/pairing/key
   */
  fetchActiveHostKey?(): Promise<{ pairingKey: string; expiresInSeconds: number }>;

  /**
   * Validates the 6-digit key entered on the mobile phone before opening tunnel.
   * @endpoint POST /api/v1/pairing/validate
   * @transport TLS Relay Server or Local LAN Handshake
   */
  validatePairingKey(req: ValidateKeyRequest): Promise<ValidateKeyResponse>;

  /**
   * Establishes the secure E2E Ed25519 encrypted tunnel between phone and PC.
   * @endpoint POST /api/v1/tunnel/connect
   * @transport WebSocket / WebRTC DataChannel (Sub-20ms)
   */
  connectToHost(req: ConnectHostRequest): Promise<ConnectHostResponse>;

  /**
   * Closes the active remote session and tears down the tunnel.
   * @endpoint POST /api/v1/tunnel/disconnect
   * @transport WebSocket close / REST
   */
  disconnectHost(): Promise<void>;

  /**
   * Fetches latest host hardware health, latency, and daemon metrics.
   * @endpoint GET /api/v1/host/status
   * @transport REST / Heartbeat Ping
   */
  getHostDeviceInfo(): Promise<DeviceInfo>;

  /**
   * Toggles or restarts the native Windows background daemon process.
   * @endpoint POST /api/v1/host/daemon/control
   * @transport Windows Service Controller / IPC
   */
  setHostServerStatus(status: 'start' | 'stop' | 'restart'): Promise<HostServerStatusResponse>;
}

// ============================================================================
// 3. TERMINAL & PTY SERVICE CONTRACTS
// ============================================================================

export interface CreateSessionRequest {
  title: string;
  type: TerminalSession['type'];
  workingDir?: string;
}

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
    content: string;
    delay?: number;
  }>;
  exitCode?: number;
  interceptCliPrompt?: {
    toolName: string;
    cliName: string;
    installCommand: string;
  };
}

export interface SendSignalRequest {
  sessionId: string;
  signal: 'SIGINT' | 'SIGTERM' | 'CLEAR';
}

/**
 * Service contract for Pseudoterminal (PTY) emulation and shell process dispatch.
 * Real backend developers must implement this over ConPTY (Windows) or PTY (Linux/Mac).
 */
export interface ITerminalService {
  /**
   * Lists all open shell/CLI sessions running on the Windows PC.
   * @endpoint GET /api/v1/pty/sessions
   * @transport REST
   */
  listSessions(): Promise<TerminalSession[]>;

  /**
   * Spawns a new ConPTY session (pwsh, cmd, bash, or AI agent) on the host PC.
   * @endpoint POST /api/v1/pty/sessions
   * @transport REST / WebSocket
   */
  createSession(req: CreateSessionRequest): Promise<TerminalSession>;

  /**
   * Closes a running PTY session and kills the attached process tree.
   * @endpoint DELETE /api/v1/pty/sessions/:id
   * @transport REST
   */
  closeSession(sessionId: string): Promise<void>;

  /**
   * Dispatches input string to the running PTY stdin or buffers offline if disconnected.
   * @endpoint POST /api/v1/pty/sessions/:id/input
   * @transport WebSocket Frame / ConPTY Write
   */
  executeCommand(req: ExecuteCommandRequest): Promise<ExecuteCommandResponse>;

  /**
   * Sends POSIX/Windows control signals (Ctrl+C, Ctrl+Break, Clear) to active PTY.
   * @endpoint POST /api/v1/pty/sessions/:id/signal
   * @transport ConPTY GenerateConsoleCtrlEvent
   */
  sendSignal(req: SendSignalRequest): Promise<void>;
}

// ============================================================================
// 4. FILE SYSTEM SERVICE CONTRACTS
// ============================================================================

export interface ListFilesRequest {
  projectPath: string;
  subDirectory?: string;
}

export interface ReadFileRequest {
  filePath: string;
}

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

export interface WriteFileResponse {
  success: boolean;
  bytesWritten: number;
  newHash: string;
  lastModified: string;
}

export interface CreateFileRequest {
  directoryPath: string;
  fileName: string;
  isTextOnly?: boolean;
}

export interface DeleteFileRequest {
  filePath: string;
}

/**
 * Service contract for Remote File System operations on the Windows PC.
 * Real backend developers must implement this against native Win32/std::fs APIs.
 */
export interface IFileSystemService {
  /**
   * Lists directory contents and file metadata.
   * @endpoint GET /api/v1/fs/list?dir=...
   * @transport REST
   */
  listFiles(req: ListFilesRequest): Promise<ProjectFile[]>;

  /**
   * Reads raw file contents for viewing and editing.
   * @endpoint GET /api/v1/fs/read?path=...
   * @transport REST
   */
  readFile(req: ReadFileRequest): Promise<ReadFileResponse>;

  /**
   * Writes buffer to disk on the Windows PC and updates Git dirty status.
   * @endpoint POST /api/v1/fs/write
   * @transport REST
   */
  writeFile(req: WriteFileRequest): Promise<WriteFileResponse>;

  /**
   * Creates a new empty or text file in the workspace.
   * @endpoint POST /api/v1/fs/create
   * @transport REST
   */
  createFile(req: CreateFileRequest): Promise<ProjectFile>;

  /**
   * Deletes a file or directory on the host PC.
   * @endpoint DELETE /api/v1/fs/delete
   * @transport REST
   */
  deleteFile(req: DeleteFileRequest): Promise<void>;
}

// ============================================================================
// 5. SOURCE CONTROL / GIT SERVICE CONTRACTS
// ============================================================================

export interface GitStatusResponse {
  projectPath: string;
  branch: string;
  isDirty: boolean;
  dirtyFilesCount: number;
  ahead: number;
  behind: number;
  lastCommit: {
    hash: string;
    message: string;
    author: string;
    time: string;
  };
  changedFiles: Array<{
    path: string;
    status: 'M' | 'A' | 'D' | 'U';
    staged: boolean;
  }>;
}

export interface GitCommitRequest {
  projectPath: string;
  message: string;
  amend?: boolean;
}

export interface GitCommitResponse {
  commitHash: string;
  branch: string;
  summary: string;
}

export interface GitPushPullResponse {
  success: boolean;
  output: string;
  newHeadCommit?: string;
}

/**
 * Service contract for Git Version Control operations.
 * Real backend developers must implement this via libgit2 or git CLI wrapper.
 */
export interface IGitService {
  /**
   * Fetches Git repository status, branch, and working tree modifications.
   * @endpoint GET /api/v1/git/status?project=...
   * @transport REST
   */
  getStatus(projectPath: string): Promise<GitStatusResponse>;

  /**
   * Stages specified files for commit (git add).
   * @endpoint POST /api/v1/git/stage
   * @transport REST
   */
  stageFiles(files: string[]): Promise<void>;

  /**
   * Unstages specified files (git restore --staged).
   * @endpoint POST /api/v1/git/unstage
   * @transport REST
   */
  unstageFiles(files: string[]): Promise<void>;

  /**
   * Creates a new commit in the repository.
   * @endpoint POST /api/v1/git/commit
   * @transport REST
   */
  commit(req: GitCommitRequest): Promise<GitCommitResponse>;

  /**
   * Pushes current branch to remote upstream.
   * @endpoint POST /api/v1/git/push
   * @transport REST
   */
  push(branch?: string): Promise<GitPushPullResponse>;

  /**
   * Pulls remote changes into current branch.
   * @endpoint POST /api/v1/git/pull
   * @transport REST
   */
  pull(branch?: string): Promise<GitPushPullResponse>;

  /**
   * Switches git branch or creates a new branch.
   * @endpoint POST /api/v1/git/checkout
   * @transport REST
   */
  switchBranch(branchName: string): Promise<void>;
}

// ============================================================================
// 6. CLI TOOLING & AI AGENT DISCOVERY CONTRACTS
// ============================================================================

export interface InstallToolResponse {
  toolId: string;
  success: boolean;
  installedVersion: string;
  outputLog: string;
}

export interface CliStatusResponse {
  cliName: string;
  isInstalled: boolean;
  version?: string;
  path?: string;
}

/**
 * Service contract for developer CLI tools (Claude Code, OpenAI Codex, Gemini CLI).
 * Real backend developers must query Windows PATH and package managers (npm, cargo, pip).
 */
export interface ICliService {
  /**
   * Discovers and lists all registered CLI tools and their host installation states.
   * @endpoint GET /api/v1/cli/tools
   * @transport REST
   */
  listTools(): Promise<AiCliTool[]>;

  /**
   * Executes package manager installer (e.g. npm install -g @anthropic-ai/claude-code).
   * @endpoint POST /api/v1/cli/install
   * @transport REST / Long-running job
   */
  installTool(toolId: string): Promise<InstallToolResponse>;

  /**
   * Checks whether an arbitrary CLI executable exists in the host system PATH.
   * @endpoint GET /api/v1/cli/check?name=...
   * @transport REST
   */
  checkCliStatus(cliName: string): Promise<CliStatusResponse>;
}

// ============================================================================
// 7. PREVIEW & TUNNEL SERVICE CONTRACTS
// ============================================================================

export interface PythonPreviewResponse {
  scriptPath: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
}

export interface DesktopAppStreamInfo {
  appId: string;
  appName: string;
  windowTitle: string;
  isStreamActive: boolean;
  fps: number;
  resolution: string;
  streamUrl: string;
}

/**
 * Service contract for Web Previews, Python execution, and Windows App window streaming.
 * Real backend developers must implement HTTP port forwarding tunnels and screen capture.
 */
export interface IPreviewService {
  /**
   * Lists active development HTTP servers running on localhost.
   * @endpoint GET /api/v1/preview/servers
   * @transport REST
   */
  listDevServers(): Promise<DevServer[]>;

  /**
   * Starts or restarts a project development server on a target port.
   * @endpoint POST /api/v1/preview/servers/start
   * @transport REST
   */
  startDevServer(command: string, port: number): Promise<DevServer>;

  /**
   * Stops an active dev server process.
   * @endpoint POST /api/v1/preview/servers/stop
   * @transport REST
   */
  stopDevServer(serverId: string): Promise<void>;

  /**
   * Executes a Python script and captures stdout/stderr for mobile preview.
   * @endpoint POST /api/v1/preview/python/run
   * @transport REST
   */
  runPythonPreview(scriptPath: string): Promise<PythonPreviewResponse>;

  /**
   * Fetches low-latency WebRTC desktop window stream metrics for Windows GUI apps.
   * @endpoint GET /api/v1/preview/desktop/:appId
   * @transport WebRTC PeerConnection
   */
  getDesktopAppStream(appId: string): Promise<DesktopAppStreamInfo>;
}

// ============================================================================
// 8. OFFLINE SYNC & CAUSAL RECONCILIATION CONTRACTS
// ============================================================================

export interface ReconciliationResult {
  intentId: string;
  status: CommandIntent['status'];
  output?: string;
  divergedReason?: string;
  durationMs: number;
}

export interface ReconciliationSummary {
  totalProcessed: number;
  succeeded: number;
  skipped: number;
  diverged: number;
  results: ReconciliationResult[];
}

export interface CloudExecutionResponse {
  batchId: string;
  cloudWorkerId: string;
  status: 'executing' | 'completed' | 'failed';
  results: Array<{
    intentId: string;
    command: string;
    output: string;
  }>;
}

/**
 * Service contract for Offline Intent queueing and Causal Sequence Reconciliation.
 * Real backend developers must implement SQLite WAL persistence on mobile and
 * server-side sequence replay with git base verification.
 */
export interface ISyncService {
  /**
   * Buffers an offline prompt or command into the local SQLite ledger.
   * @storage Local SQLite / IndexedDB (Phone)
   */
  queueIntent(intent: Omit<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'>): Promise<CommandIntent>;

  /**
   * Reads all queued and reconciled intents from the ledger.
   * @storage Local SQLite / IndexedDB
   */
  listQueuedIntents(): Promise<CommandIntent[]>;

  /**
   * Reconciles a single queued intent against the PC's live repository state.
   * @endpoint POST /api/v1/sync/reconcile-single
   * @transport WebSocket / REST
   */
  reconcileIntent(id: string, action: 'run' | 'skip' | 'cancel'): Promise<ReconciliationResult>;

  /**
   * Reconciles the entire queued batch in sequence with causal verification.
   * @endpoint POST /api/v1/sync/reconcile-all
   * @transport WebSocket / REST
   */
  reconcileAll(forceRun?: boolean): Promise<ReconciliationSummary>;

  /**
   * Dispatches queued intents to optional cloud sandbox worker when PC is unreachable.
   * @endpoint POST /api/v1/sync/cloud-worker/dispatch
   * @transport Cloud API Gateway
   */
  triggerCloudFallback(intentIds: string[]): Promise<CloudExecutionResponse>;
}

// ============================================================================
// MASTER BACKEND ADAPTER INTERFACE
// ============================================================================

export interface IRelayBackendAdapter {
  readonly isMock: boolean;
  readonly adapterName: string;
  readonly backendEndpoint: string;
  auth: IAuthService;
  connection: IConnectionService;
  terminal: ITerminalService;
  fileSystem: IFileSystemService;
  git: IGitService;
  cli: ICliService;
  preview: IPreviewService;
  sync: ISyncService;
}
