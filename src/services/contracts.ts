import {
  CommandIntent,
  DeviceInfo,
  DevServer,
  ProjectFile,
  TerminalLine,
  TerminalSession,
  UserAccount,
  AiCliTool,
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

export interface IAuthService {
  login(req: LoginRequest): Promise<LoginResponse>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<UserAccount>;
  refreshToken(): Promise<RefreshTokenResponse>;
}

// ============================================================================
// 2. CONNECTION & PAIRING SERVICE CONTRACTS
// ============================================================================

export interface GenerateKeyResponse {
  pairingKey: string;
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
  activeWorkspaceRoot?: string;
  errorMessage?: string;
}

export interface HostServerStatusResponse {
  status: 'running' | 'stopped' | 'starting';
  activePortBindings: number[];
  cpuUsagePercent: number;
  memoryUsageMb: number;
}

export interface IConnectionService {
  generateHostKey(): Promise<GenerateKeyResponse>;
  fetchActiveHostKey?(): Promise<{ pairingKey: string; expiresInSeconds: number }>;
  validatePairingKey(req: ValidateKeyRequest): Promise<ValidateKeyResponse>;
  connectToHost(req: ConnectHostRequest): Promise<ConnectHostResponse>;
  disconnectHost(): Promise<void>;
  getHostDeviceInfo(): Promise<DeviceInfo & { activeWorkspaceRoot?: string }>;
  setHostServerStatus(status: 'start' | 'stop' | 'restart'): Promise<HostServerStatusResponse>;
}

// ============================================================================
// 2B. DYNAMIC WINDOWS WORKSPACE SERVICE CONTRACTS
// ============================================================================

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  exists: boolean;
  accessible: boolean;
  isGitRepo: boolean;
  gitRoot?: string;
  branch?: string;
  dirtyFiles?: number;
  lastCommitHash?: string;
  lastCommitMsg?: string;
  lastSyncedAt?: string;
}

export interface WorkspaceStateResponse {
  activeWorkspace: WorkspaceInfo | null;
  recentWorkspaces: WorkspaceInfo[];
  allowedRoots: string[];
}

export interface WorkspaceBrowseEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
  lastModified?: string;
}

export interface WorkspaceBrowseResponse {
  currentPath: string | null;
  parentPath: string | null;
  drives: string[];
  entries: WorkspaceBrowseEntry[];
}

export interface IWorkspaceService {
  getState(): Promise<WorkspaceStateResponse>;
  browse(dirPath?: string): Promise<WorkspaceBrowseResponse>;
  selectWorkspace(folderPath: string): Promise<{ workspace: WorkspaceInfo; recentWorkspaces: WorkspaceInfo[] }>;
  pickNativeFolder(initialPath?: string): Promise<{ cancelled: boolean; workspace?: WorkspaceInfo }>;
  scanRepositories(rootPath?: string): Promise<{ repositories: WorkspaceInfo[] }>;
}

// ============================================================================
// 3. TERMINAL & PTY SERVICE CONTRACTS
// ============================================================================

export interface CreateSessionRequest {
  title: string;
  type: TerminalSession['type'];
  workingDir?: string;
  cols?: number;
  rows?: number;
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
  workingDir?: string;
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

export interface ITerminalService {
  listSessions(): Promise<TerminalSession[]>;
  getSession?(sessionId: string): Promise<TerminalSession>;
  createSession(req: CreateSessionRequest): Promise<TerminalSession>;
  closeSession(sessionId: string): Promise<void>;
  executeCommand(req: ExecuteCommandRequest): Promise<ExecuteCommandResponse>;
  sendSignal(req: SendSignalRequest): Promise<void>;
  resizeSession?(sessionId: string, cols: number, rows: number): Promise<void>;
  subscribeSessionStream?(
    sessionId: string,
    onLine: (line: TerminalLine & { workingDir?: string }) => void,
    onError?: (err: unknown) => void,
  ): () => void;
}

// ============================================================================
// 4. FILE SYSTEM SERVICE CONTRACTS
// ============================================================================

export interface ListFilesRequest {
  projectPath: string;
  subDirectory?: string;
  limit?: number;
  offset?: number;
}

export interface ReadFileRequest {
  filePath: string;
  projectPath?: string;
}

export interface ReadFileResponse {
  filePath: string;
  content: string;
  sizeBytes: number;
  size?: number;
  hash?: string;
  encoding: 'utf-8' | 'binary';
  lastModified: string;
}

export interface WriteFileRequest {
  filePath: string;
  projectPath?: string;
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
  projectPath?: string;
  fileName: string;
  isTextOnly?: boolean;
  isFolder?: boolean;
  content?: string;
}

export interface RenameFileRequest {
  projectPath: string;
  oldPath: string;
  newName: string;
}

export interface RenameFileResponse {
  success: boolean;
  oldPath: string;
  newPath: string;
  name: string;
  type: 'file' | 'folder';
}

export interface DeleteFileRequest {
  filePath: string;
  projectPath?: string;
  recursive?: boolean;
}

export interface FileStatResponse {
  name: string;
  path: string;
  fullPath: string;
  type: 'file' | 'folder';
  size: number;
  lastModified: string;
  readonly: boolean;
}

export interface IFileSystemService {
  listFiles(req: ListFilesRequest): Promise<ProjectFile[]>;
  statFile?(filePath: string, projectPath?: string): Promise<FileStatResponse>;
  readFile(req: ReadFileRequest): Promise<ReadFileResponse>;
  writeFile(req: WriteFileRequest): Promise<WriteFileResponse>;
  createFile(req: CreateFileRequest): Promise<ProjectFile>;
  renameFile?(req: RenameFileRequest): Promise<RenameFileResponse>;
  deleteFile(req: DeleteFileRequest): Promise<void>;
}

// ============================================================================
// 5. SOURCE CONTROL / GIT SERVICE CONTRACTS
// ============================================================================

export interface GitStatusResponse {
  isGitRepo?: boolean;
  projectPath: string;
  rootPath?: string;
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

export interface IGitService {
  getStatus(projectPath: string): Promise<GitStatusResponse>;
  getBranches?(projectPath: string): Promise<{ currentBranch: string; branches: string[] }>;
  getDiff?(projectPath: string, filePath?: string, staged?: boolean): Promise<string>;
  stageFiles(files: string[], projectPath?: string): Promise<void>;
  unstageFiles(files: string[], projectPath?: string): Promise<void>;
  commit(req: GitCommitRequest): Promise<GitCommitResponse>;
  push(branch?: string, projectPath?: string): Promise<GitPushPullResponse>;
  pull(branch?: string, projectPath?: string): Promise<GitPushPullResponse>;
  switchBranch(branchName: string, projectPath?: string, createNew?: boolean): Promise<void>;
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
  authStatus?: 'authenticated' | 'unauthenticated' | 'unknown' | 'not_installed';
  authDetail?: string;
}

export interface ICliService {
  listTools(): Promise<AiCliTool[]>;
  installTool(toolId: string): Promise<InstallToolResponse>;
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
  supported?: boolean;
  reason?: string;
}

export interface IPreviewService {
  listDevServers(): Promise<DevServer[]>;
  startDevServer(command: string, port: number, workingDir?: string): Promise<DevServer>;
  stopDevServer(serverId: string): Promise<void>;
  runPythonPreview(scriptPath: string): Promise<PythonPreviewResponse>;
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

export interface ISyncService {
  queueIntent(
    intent: Omit<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'>,
  ): Promise<CommandIntent>;
  listQueuedIntents(): Promise<CommandIntent[]>;
  reconcileIntent(id: string, action: 'run' | 'skip' | 'cancel'): Promise<ReconciliationResult>;
  reconcileAll(forceRun?: boolean): Promise<ReconciliationSummary>;
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
  workspace?: IWorkspaceService;
  terminal: ITerminalService;
  fileSystem: IFileSystemService;
  git: IGitService;
  cli: ICliService;
  preview: IPreviewService;
  sync: ISyncService;
}
