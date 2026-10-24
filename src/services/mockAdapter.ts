import { 
  IRelayBackendAdapter, 
  IAuthService, 
  IConnectionService, 
  ITerminalService, 
  IFileSystemService, 
  IGitService, 
  ICliService, 
  IPreviewService, 
  ISyncService,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  GenerateKeyResponse,
  ValidateKeyRequest,
  ValidateKeyResponse,
  ConnectHostRequest,
  ConnectHostResponse,
  HostServerStatusResponse,
  CreateSessionRequest,
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  SendSignalRequest,
  ListFilesRequest,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  CreateFileRequest,
  DeleteFileRequest,
  GitStatusResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitPushPullResponse,
  InstallToolResponse,
  CliStatusResponse,
  PythonPreviewResponse,
  DesktopAppStreamInfo,
  ReconciliationResult,
  ReconciliationSummary,
  CloudExecutionResponse
} from './contracts';
import { 
  CommandIntent, 
  DeviceInfo, 
  DevServer, 
  ProjectFile, 
  TerminalSession, 
  UserAccount,
  AiCliTool 
} from '../types/relay';
import { executeCommandOnDaemon } from './mockDaemon';

/**
 * Mock implementation of the Relay Backend Adapter for frontend development and prototyping.
 * 
 * NOTE FOR BACKEND DEVELOPER:
 * To integrate a real Windows host daemon and cloud infrastructure:
 * 1. Create `RealBackendAdapter.ts` implementing `IRelayBackendAdapter`.
 * 2. Implement the 8 sub-service interfaces using your real WebSocket / REST client.
 * 3. In `src/services/index.ts`, change `getActiveBackendAdapter()` to instantiate your real adapter.
 * Frontend components interact exclusively with `IRelayBackendAdapter` and require zero rewrites.
 */
export class MockRelayBackendAdapter implements IRelayBackendAdapter {
  readonly isMock = true;
  readonly adapterName = 'Mock Relay Adapter (Development Harness)';
  readonly backendEndpoint = 'ws://127.0.0.1:9871 (Simulated)';

  // Sub-services
  auth: IAuthService;
  connection: IConnectionService;
  terminal: ITerminalService;
  fileSystem: IFileSystemService;
  git: IGitService;
  cli: ICliService;
  preview: IPreviewService;
  sync: ISyncService;

  constructor() {
    this.auth = new MockAuthService();
    this.connection = new MockConnectionService();
    this.terminal = new MockTerminalService();
    this.fileSystem = new MockFileSystemService();
    this.git = new MockGitService();
    this.cli = new MockCliService();
    this.preview = new MockPreviewService();
    this.sync = new MockSyncService();
  }
}

// ----------------------------------------------------------------------------
// 1. Mock Auth Service
// ----------------------------------------------------------------------------
class MockAuthService implements IAuthService {
  private currentUser: UserAccount = {
    id: 'usr_dev_7701',
    username: 'alex.chen',
    email: 'alex.chen@workplace.internal',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    accountTier: 'Pro Developer',
    isLoggedIn: true,
    tokenExpiresAt: '2026-10-15 23:59 UTC',
  };

  async login(req: LoginRequest): Promise<LoginResponse> {
    await new Promise((r) => setTimeout(r, 600));
    const username = req.email.includes('@') ? req.email.split('@')[0] : 'developer';
    this.currentUser = {
      ...this.currentUser,
      email: req.email,
      username,
      isLoggedIn: true,
    };
    return {
      user: this.currentUser,
      authToken: `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tokenExpiresAt: '2026-10-15 23:59 UTC',
      isMockResponse: true,
    };
  }

  async logout(): Promise<void> {
    this.currentUser = { ...this.currentUser, isLoggedIn: false };
  }

  async getCurrentUser(): Promise<UserAccount> {
    return this.currentUser;
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    return {
      authToken: `mock_jwt_refreshed_${Date.now()}`,
      tokenExpiresAt: '2026-10-20 23:59 UTC',
    };
  }
}

// ----------------------------------------------------------------------------
// 2. Mock Connection Service
// ----------------------------------------------------------------------------
class MockConnectionService implements IConnectionService {
  private activeKey = '784-291';
  private deviceInfo: DeviceInfo = {
    isOnline: true,
    deviceName: 'DESKTOP-WIN11-PRO',
    os: 'Windows 11 Pro 23H2 (Build 22631.4169)',
    ip: '192.168.1.142',
    port: 9871,
    daemonVersion: 'v1.4.0 (tokio-xterm-vt100)',
    pingMs: 18,
    pairedAt: 'October 12, 2026',
    ed25519Fingerprint: 'SHA256:4b7f8c2e91a0...93d8',
    pairingToken: '784-291',
    sqliteDbSizeKb: 142,
    backendServerStatus: 'running',
    tunnelStatus: 'active',
    totalIntentsProcessed: 28,
    cpuUsagePercent: 4.2,
    memoryUsageMb: 184,
    activePortBindings: [5173, 9871, 3000],
  };

  async generateHostKey(): Promise<GenerateKeyResponse> {
    const d1 = Math.floor(100 + Math.random() * 900);
    const d2 = Math.floor(100 + Math.random() * 900);
    this.activeKey = `${d1}-${d2}`;
    this.deviceInfo.pairingToken = this.activeKey;
    return {
      pairingKey: this.activeKey,
      expiresInSeconds: 300,
      qrPayload: `relay://pair?host=${this.deviceInfo.ip}&port=${this.deviceInfo.port}&key=${this.activeKey}`,
    };
  }

  async fetchActiveHostKey(): Promise<{ pairingKey: string; expiresInSeconds: number }> {
    return {
      pairingKey: this.activeKey,
      expiresInSeconds: 300,
    };
  }

  async validatePairingKey(req: ValidateKeyRequest): Promise<ValidateKeyResponse> {
    await new Promise((r) => setTimeout(r, 450));
    const cleanInput = req.pairingKey.replace(/\D/g, '');
    const cleanTarget = this.activeKey.replace(/\D/g, '');
    if (cleanInput === cleanTarget || cleanInput === '784291') {
      return { isValid: true, targetDeviceName: this.deviceInfo.deviceName };
    }
    return {
      isValid: false,
      errorMessage: `Key "${req.pairingKey}" rejected by Windows host. Please check the 6-digit key displayed on your PC screen.`,
    };
  }

  async connectToHost(req: ConnectHostRequest): Promise<ConnectHostResponse> {
    const val = await this.validatePairingKey({ pairingKey: req.pairingKey });
    if (!val.isValid) {
      return {
        success: false,
        device: { ...this.deviceInfo, isOnline: false },
        sessionToken: '',
        errorMessage: val.errorMessage,
      };
    }
    return {
      success: true,
      device: { ...this.deviceInfo, isOnline: true },
      sessionToken: `tok_${Date.now()}`,
    };
  }

  async disconnectHost(): Promise<void> {
    this.deviceInfo.tunnelStatus = 'idle';
  }

  async getHostDeviceInfo(): Promise<DeviceInfo> {
    return this.deviceInfo;
  }

  async setHostServerStatus(status: 'start' | 'stop' | 'restart'): Promise<HostServerStatusResponse> {
    const isRunning = status === 'start' || status === 'restart';
    this.deviceInfo.backendServerStatus = isRunning ? 'running' : 'stopped';
    this.deviceInfo.isOnline = isRunning;
    this.deviceInfo.tunnelStatus = isRunning ? 'active' : 'idle';
    return {
      status: this.deviceInfo.backendServerStatus,
      activePortBindings: isRunning ? [5173, 9871, 3000] : [],
      cpuUsagePercent: isRunning ? 4.8 : 0.1,
      memoryUsageMb: isRunning ? 186 : 22,
    };
  }
}

// ----------------------------------------------------------------------------
// 3. Mock Terminal Service
// ----------------------------------------------------------------------------
class MockTerminalService implements ITerminalService {
  async listSessions(): Promise<TerminalSession[]> {
    return [];
  }

  async createSession(req: CreateSessionRequest): Promise<TerminalSession> {
    const id = `sess-${Date.now()}`;
    return {
      id,
      title: req.title,
      type: req.type,
      workingDir: req.workingDir || 'C:\\Projects\\hyper-relay',
      history: [],
      isRunning: false,
      buffer: [],
    };
  }

  async closeSession(_sessionId: string): Promise<void> {
    // Session cleanup
  }

  async executeCommand(req: ExecuteCommandRequest): Promise<ExecuteCommandResponse> {
    const dummyProject = {
      id: 'hyper-relay',
      name: 'hyper-relay',
      path: req.workingDir,
      branch: 'main',
      isDirty: false,
      dirtyCount: 0,
      ahead: 0,
      behind: 0,
      lastCommit: { hash: '3f7a8b1', message: 'demo', author: 'dev', time: '1m ago' },
      pinned: true,
      files: [],
    };
    const daemonRes = executeCommandOnDaemon(req.command, dummyProject, {
      claude: true,
      codex: true,
      gemini: false,
    });
    return {
      commandId: `cmd-${Date.now()}`,
      lines: daemonRes.lines,
      interceptCliPrompt: daemonRes.interceptCliPrompt,
    };
  }

  async sendSignal(_req: SendSignalRequest): Promise<void> {
    // Signal dispatch
  }
}

// ----------------------------------------------------------------------------
// 4. Mock File System Service
// ----------------------------------------------------------------------------
class MockFileSystemService implements IFileSystemService {
  async listFiles(_req: ListFilesRequest): Promise<ProjectFile[]> {
    return [];
  }

  async readFile(req: ReadFileRequest): Promise<ReadFileResponse> {
    return {
      filePath: req.filePath,
      content: '// File content from mock filesystem\n',
      sizeBytes: 128,
      encoding: 'utf-8',
      lastModified: new Date().toISOString(),
    };
  }

  async writeFile(req: WriteFileRequest): Promise<WriteFileResponse> {
    return {
      success: true,
      bytesWritten: req.content.length,
      newHash: `sha256:${Math.random().toString(16).substring(2, 10)}`,
      lastModified: 'Just now',
    };
  }

  async createFile(req: CreateFileRequest): Promise<ProjectFile> {
    const isTxt = req.isTextOnly || req.fileName.endsWith('.txt');
    return {
      name: req.fileName,
      path: `${req.directoryPath}/${req.fileName}`,
      isDir: false,
      size: '0 B',
      modified: 'Just now',
      gitStatus: 'U',
      content: isTxt ? '# New text file\n' : '// New file\n',
    };
  }

  async deleteFile(_req: DeleteFileRequest): Promise<void> {
    // Delete file
  }
}

// ----------------------------------------------------------------------------
// 5. Mock Git Service
// ----------------------------------------------------------------------------
class MockGitService implements IGitService {
  async getStatus(projectPath: string): Promise<GitStatusResponse> {
    return {
      projectPath,
      branch: 'main',
      isDirty: true,
      dirtyFilesCount: 2,
      ahead: 1,
      behind: 0,
      lastCommit: {
        hash: '3f7a8b1',
        message: 'feat: add local SQLite WAL intent persistence',
        author: 'alex.chen',
        time: '24m ago',
      },
      changedFiles: [
        { path: 'src/relay_daemon.rs', status: 'M', staged: false },
        { path: 'Cargo.toml', status: 'M', staged: false },
        { path: 'config/tunnel.yaml', status: 'U', staged: false },
      ],
    };
  }

  async stageFiles(_files: string[]): Promise<void> {}
  async unstageFiles(_files: string[]): Promise<void> {}

  async commit(req: GitCommitRequest): Promise<GitCommitResponse> {
    const hash = Math.random().toString(16).substring(2, 9);
    return {
      commitHash: hash,
      branch: 'main',
      summary: `[main ${hash}] ${req.message}`,
    };
  }

  async push(_branch?: string): Promise<GitPushPullResponse> {
    await new Promise((r) => setTimeout(r, 800));
    return {
      success: true,
      output: 'To github.com:org/hyper-relay.git\n   3f7a8b1..7e1a0b3  main -> main',
    };
  }

  async pull(_branch?: string): Promise<GitPushPullResponse> {
    await new Promise((r) => setTimeout(r, 700));
    return {
      success: true,
      output: 'Already up to date.',
    };
  }

  async switchBranch(_branchName: string): Promise<void> {}
}

// ----------------------------------------------------------------------------
// 6. Mock CLI Service
// ----------------------------------------------------------------------------
class MockCliService implements ICliService {
  async listTools(): Promise<AiCliTool[]> {
    return [];
  }

  async installTool(toolId: string): Promise<InstallToolResponse> {
    await new Promise((r) => setTimeout(r, 1200));
    return {
      toolId,
      success: true,
      installedVersion: 'v1.1.0',
      outputLog: `+ ${toolId}@1.1.0 installed globally in %APPDATA%\\npm\\node_modules`,
    };
  }

  /**
   * Checks whether a CLI or AI tool is available on the Windows PC.
   * 
   * NOTE ON TOOL AVAILABILITY & BACKEND INTEGRATION:
   * - 'claude': Integrated via npm @anthropic-ai/claude-code (Installed).
   * - 'codex': Integrated via npm @openai/codex-cli (Installed).
   * - 'gemini': Integrated via npm @google/gemini-cli (Needs Setup / Auth).
   * - 'antigravity': Unavailable. Antigravity is an agent environment rather than
   *   a standalone CLI binary. It requires a dedicated host daemon bridge
   *   (e.g., IAntigravityBridgeService on port 9872) to stream agent actions and
   *   workspace context. Until that host daemon bridge is running, Antigravity
   *   remains marked as 'Unavailable' in the mobile client selector.
   */
  async checkCliStatus(cliName: string): Promise<CliStatusResponse> {
    const isInstalled = cliName === 'claude' || cliName === 'codex';
    return {
      cliName,
      isInstalled,
      version: cliName === 'claude' ? 'v1.0.8' : cliName === 'codex' ? 'v0.9.4' : undefined,
    };
  }
}

// ----------------------------------------------------------------------------
// 7. Mock Preview Service
// ----------------------------------------------------------------------------
class MockPreviewService implements IPreviewService {
  async listDevServers(): Promise<DevServer[]> {
    return [];
  }

  async startDevServer(_command: string, port: number): Promise<DevServer> {
    return {
      id: `srv-${Date.now()}`,
      port,
      url: `http://localhost:${port}`,
      name: `Dev Server :${port}`,
      framework: 'Custom Process',
      status: 'active',
      tunnelLatencyMs: 16,
      route: '/',
    };
  }

  async stopDevServer(_serverId: string): Promise<void> {}

  async runPythonPreview(scriptPath: string): Promise<PythonPreviewResponse> {
    await new Promise((r) => setTimeout(r, 600));
    return {
      scriptPath,
      exitCode: 0,
      stdout: `[Python 3.12.2 Execution in C:\\Projects\\hyper-relay]\nDataset shape: (1024, 8)\nMetrics: Accuracy: 98.4% | Loss: 0.042\nSaved artifact to ./output/results.json\nDone in 0.58s.`,
      stderr: '',
      executionTimeMs: 580,
    };
  }

  async getDesktopAppStream(appId: string): Promise<DesktopAppStreamInfo> {
    return {
      appId,
      appName: 'HyperRelay GUI Diagnostic (WinUI 3)',
      windowTitle: 'HyperRelay Local Debugger - [C:\\Projects\\hyper-relay]',
      isStreamActive: true,
      fps: 60,
      resolution: '1920x1080 (H.264 WebRTC Hardware Accelerated)',
      streamUrl: 'webrtc://tunnel/stream/desktop-win11',
    };
  }
}

// ----------------------------------------------------------------------------
// 8. Mock Sync Service
// ----------------------------------------------------------------------------
class MockSyncService implements ISyncService {
  private queue: CommandIntent[] = [];

  async queueIntent(intent: Omit<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'>): Promise<CommandIntent> {
    const newIntent: CommandIntent = {
      ...intent,
      id: `intent-${Date.now()}`,
      seq: this.queue.length + 1,
      timestamp: Date.now(),
      status: 'queued',
    };
    this.queue.push(newIntent);
    return newIntent;
  }

  async listQueuedIntents(): Promise<CommandIntent[]> {
    return this.queue;
  }

  async reconcileIntent(id: string, action: 'run' | 'skip' | 'cancel'): Promise<ReconciliationResult> {
    await new Promise((r) => setTimeout(r, 500));
    const item = this.queue.find((i) => i.id === id);
    if (!item) {
      return { intentId: id, status: 'failed', durationMs: 0 };
    }
    item.status = action === 'run' ? 'reconciled' : action === 'skip' ? 'skipped' : 'cancelled';
    return {
      intentId: id,
      status: item.status,
      output: action === 'run' ? `Executed ${item.command} on host PC.` : undefined,
      durationMs: 420,
    };
  }

  async reconcileAll(_forceRun?: boolean): Promise<ReconciliationSummary> {
    const results: ReconciliationResult[] = [];
    for (const item of this.queue) {
      const res = await this.reconcileIntent(item.id, 'run');
      results.push(res);
    }
    return {
      totalProcessed: results.length,
      succeeded: results.filter((r) => r.status === 'reconciled').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      diverged: results.filter((r) => r.status === 'diverged').length,
      results,
    };
  }

  async triggerCloudFallback(intentIds: string[]): Promise<CloudExecutionResponse> {
    await new Promise((r) => setTimeout(r, 1200));
    return {
      batchId: `batch-${Date.now()}`,
      cloudWorkerId: 'worker-us-central1-c-04',
      status: 'completed',
      results: intentIds.map((id) => ({
        intentId: id,
        command: 'cloud-fallback',
        output: 'Executed successfully in ephemeral Linux container.',
      })),
    };
  }
}
