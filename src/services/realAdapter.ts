/**
 * Lazy Terminal — Real backend adapter for the Windows PC companion.
 *
 * Implements `IRelayBackendAdapter` by making actual HTTP/SSE calls to the
 * authenticated Windows PC host companion APIs.
 *
 * @module realAdapter
 */

import {
  IRelayBackendAdapter,
  IAuthService,
  IConnectionService,
  IWorkspaceService,
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
  WorkspaceInfo,
  WorkspaceStateResponse,
  WorkspaceBrowseResponse,
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
  RenameFileRequest,
  RenameFileResponse,
  DeleteFileRequest,
  FileStatResponse,
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
  CloudExecutionResponse,
} from './contracts';
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
import { apiRequest, getSessionToken, setSessionToken, ApiError } from './apiClient';
import { enqueueIntent, listIntents } from './offlineQueue';
import { getAppConfig } from './config';

// ---------------------------------------------------------------------------
// Master adapter
// ---------------------------------------------------------------------------

export class RealRelayBackendAdapter implements IRelayBackendAdapter {
  readonly isMock = false;
  readonly adapterName = 'Lazy Terminal Real Adapter';
  readonly backendEndpoint: string;

  auth: IAuthService;
  connection: IConnectionService;
  workspace: IWorkspaceService;
  terminal: ITerminalService;
  fileSystem: IFileSystemService;
  git: IGitService;
  cli: ICliService;
  preview: IPreviewService;
  sync: ISyncService;

  constructor(endpointUrl?: string) {
    this.backendEndpoint = endpointUrl || getAppConfig().hostBaseUrl;
    this.auth = new RealAuthService();
    this.connection = new RealConnectionService();
    this.workspace = new RealWorkspaceService();
    this.terminal = new RealTerminalService();
    this.fileSystem = new RealFileSystemService();
    this.git = new RealGitService();
    this.cli = new RealCliService();
    this.preview = new RealPreviewService();
    this.sync = new RealSyncService();
  }
}

// ---------------------------------------------------------------------------
// 1. Auth Service
// ---------------------------------------------------------------------------

class RealAuthService implements IAuthService {
  async login(req: LoginRequest): Promise<LoginResponse> {
    const res = await apiRequest<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: req,
      skipAuth: true,
    });
    if (res.authToken) {
      setSessionToken(res.authToken);
    }
    return res;
  }

  async logout(): Promise<void> {
    try {
      await apiRequest<void>('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setSessionToken(null);
    }
  }

  async getCurrentUser(): Promise<UserAccount> {
    return apiRequest<UserAccount>('/api/v1/auth/me');
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    const res = await apiRequest<RefreshTokenResponse>('/api/v1/auth/refresh', {
      method: 'POST',
    });
    if (res.authToken) {
      setSessionToken(res.authToken);
    }
    return res;
  }
}

// ---------------------------------------------------------------------------
// 2. Connection & Pairing Service
// ---------------------------------------------------------------------------

class RealConnectionService implements IConnectionService {
  async generateHostKey(): Promise<GenerateKeyResponse> {
    return apiRequest<GenerateKeyResponse>('/api/v1/pairing/generate', {
      method: 'POST',
      skipAuth: true,
    });
  }

  async fetchActiveHostKey(): Promise<{ pairingKey: string; expiresInSeconds: number }> {
    return apiRequest<{ pairingKey: string; expiresInSeconds: number }>('/api/v1/pairing/key', {
      method: 'GET',
      skipAuth: true,
    });
  }

  async validatePairingKey(req: ValidateKeyRequest): Promise<ValidateKeyResponse> {
    return apiRequest<ValidateKeyResponse>('/api/v1/pairing/validate', {
      method: 'POST',
      body: req,
      skipAuth: true,
    });
  }

  async connectToHost(req: ConnectHostRequest): Promise<ConnectHostResponse> {
    const res = await apiRequest<ConnectHostResponse>('/api/v1/tunnel/connect', {
      method: 'POST',
      body: req,
      skipAuth: true,
    });
    if (res.success && res.sessionToken) {
      setSessionToken(res.sessionToken);
    }
    return res;
  }

  async disconnectHost(): Promise<void> {
    try {
      await apiRequest<void>('/api/v1/tunnel/disconnect', { method: 'POST' });
    } finally {
      setSessionToken(null);
    }
  }

  async getHostDeviceInfo(): Promise<DeviceInfo & { activeWorkspaceRoot?: string }> {
    return apiRequest<DeviceInfo & { activeWorkspaceRoot?: string }>('/api/v1/host/status');
  }

  async setHostServerStatus(status: 'start' | 'stop' | 'restart'): Promise<HostServerStatusResponse> {
    return apiRequest<HostServerStatusResponse>('/api/v1/host/daemon/control', {
      method: 'POST',
      body: { status },
    });
  }
}

// ---------------------------------------------------------------------------
// 2B. Workspace Service
// ---------------------------------------------------------------------------

class RealWorkspaceService implements IWorkspaceService {
  async getState(): Promise<WorkspaceStateResponse> {
    return apiRequest<WorkspaceStateResponse>('/api/v1/workspace');
  }

  async browse(dirPath?: string): Promise<WorkspaceBrowseResponse> {
    const params = new URLSearchParams();
    if (dirPath) params.set('path', dirPath);
    const qs = params.toString();
    return apiRequest<WorkspaceBrowseResponse>(`/api/v1/workspace/browse${qs ? `?${qs}` : ''}`);
  }

  async selectWorkspace(
    folderPath: string,
  ): Promise<{ workspace: WorkspaceInfo; recentWorkspaces: WorkspaceInfo[] }> {
    return apiRequest<{ workspace: WorkspaceInfo; recentWorkspaces: WorkspaceInfo[] }>(
      '/api/v1/workspace/select',
      {
        method: 'POST',
        body: { path: folderPath },
      },
    );
  }

  async pickNativeFolder(
    initialPath?: string,
  ): Promise<{ cancelled: boolean; workspace?: WorkspaceInfo }> {
    return apiRequest<{ cancelled: boolean; workspace?: WorkspaceInfo }>(
      '/api/v1/workspace/pick-native',
      {
        method: 'POST',
        body: { initialPath },
        timeoutMs: 120_000,
      },
    );
  }

  async scanRepositories(rootPath?: string): Promise<{ repositories: WorkspaceInfo[] }> {
    return apiRequest<{ repositories: WorkspaceInfo[] }>('/api/v1/workspace/scan-repos', {
      method: 'POST',
      body: { rootPath },
      timeoutMs: 30_000,
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Terminal & PTY Service
// ---------------------------------------------------------------------------

class RealTerminalService implements ITerminalService {
  async listSessions(): Promise<TerminalSession[]> {
    const res = await apiRequest<TerminalSession[] | { sessions?: TerminalSession[] }>(
      '/api/v1/pty/sessions',
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.sessions)) return res.sessions;
    return [];
  }

  async getSession(sessionId: string): Promise<TerminalSession> {
    return apiRequest<TerminalSession>(`/api/v1/pty/sessions/${encodeURIComponent(sessionId)}`);
  }

  async createSession(req: CreateSessionRequest): Promise<TerminalSession> {
    return apiRequest<TerminalSession>('/api/v1/pty/sessions', {
      method: 'POST',
      body: req,
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    return apiRequest<void>(`/api/v1/pty/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  }

  async executeCommand(req: ExecuteCommandRequest): Promise<ExecuteCommandResponse> {
    return apiRequest<ExecuteCommandResponse>(
      `/api/v1/pty/sessions/${encodeURIComponent(req.sessionId)}/input`,
      {
        method: 'POST',
        body: req,
        timeoutMs: 120_000,
        retries: 0, // Never retry non-idempotent terminal commands!
      },
    );
  }

  async sendSignal(req: SendSignalRequest): Promise<void> {
    return apiRequest<void>(
      `/api/v1/pty/sessions/${encodeURIComponent(req.sessionId)}/signal`,
      {
        method: 'POST',
        body: { signal: req.signal },
        retries: 0,
      },
    );
  }

  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    await apiRequest<void>(
      `/api/v1/pty/sessions/${encodeURIComponent(sessionId)}/resize`,
      {
        method: 'POST',
        body: { cols, rows },
        retries: 0,
      },
    );
  }

  subscribeSessionStream(
    sessionId: string,
    onLine: (line: TerminalLine & { workingDir?: string }) => void,
    onError?: (err: unknown) => void,
  ): () => void {
    const token = getSessionToken();
    const config = getAppConfig();
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    const streamUrl = `${config.hostBaseUrl}/api/v1/pty/sessions/${encodeURIComponent(sessionId)}/stream?${params.toString()}`;

    if (typeof EventSource !== 'undefined') {
      const es = new EventSource(streamUrl);
      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed && typeof parsed.content === 'string') {
            onLine(parsed);
          }
        } catch {}
      };
      es.onerror = (err) => {
        onError?.(err);
      };
      return () => {
        es.close();
      };
    }

    return () => {};
  }
}

// ---------------------------------------------------------------------------
// 4. File System Service
// ---------------------------------------------------------------------------

class RealFileSystemService implements IFileSystemService {
  async listFiles(req: ListFilesRequest): Promise<ProjectFile[]> {
    const params = new URLSearchParams({ projectPath: req.projectPath });
    if (req.subDirectory) params.set('subDirectory', req.subDirectory);
    if (req.limit != null) params.set('limit', String(req.limit));
    if (req.offset != null) params.set('offset', String(req.offset));
    const res = await apiRequest<{ files?: ProjectFile[] } | ProjectFile[]>(
      `/api/v1/fs/list?${params.toString()}`,
    );
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.files)) return res.files;
    return [];
  }

  async statFile(filePath: string, projectPath?: string): Promise<FileStatResponse> {
    const params = new URLSearchParams({ filePath });
    if (projectPath) params.set('projectPath', projectPath);
    return apiRequest<FileStatResponse>(`/api/v1/fs/stat?${params.toString()}`);
  }

  async readFile(req: ReadFileRequest): Promise<ReadFileResponse> {
    const params = new URLSearchParams({ filePath: req.filePath });
    if (req.projectPath) params.set('projectPath', req.projectPath);
    return apiRequest<ReadFileResponse>(`/api/v1/fs/read?${params.toString()}`);
  }

  async writeFile(req: WriteFileRequest): Promise<WriteFileResponse> {
    return apiRequest<WriteFileResponse>('/api/v1/fs/write', {
      method: 'POST',
      body: req,
      retries: 0,
    });
  }

  async createFile(req: CreateFileRequest): Promise<ProjectFile> {
    return apiRequest<ProjectFile>('/api/v1/fs/create', {
      method: 'POST',
      body: req,
      retries: 0,
    });
  }

  async renameFile(req: RenameFileRequest): Promise<RenameFileResponse> {
    return apiRequest<RenameFileResponse>('/api/v1/fs/rename', {
      method: 'POST',
      body: req,
      retries: 0,
    });
  }

  async deleteFile(req: DeleteFileRequest): Promise<void> {
    return apiRequest<void>('/api/v1/fs/delete', {
      method: 'DELETE',
      body: req,
      retries: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Git Service
// ---------------------------------------------------------------------------

class RealGitService implements IGitService {
  async getStatus(projectPath: string): Promise<GitStatusResponse> {
    const params = new URLSearchParams({ projectPath });
    return apiRequest<GitStatusResponse>(`/api/v1/git/status?${params.toString()}`);
  }

  async getBranches(
    projectPath: string,
  ): Promise<{ currentBranch: string; branches: string[] }> {
    const params = new URLSearchParams({ projectPath });
    return apiRequest<{ currentBranch: string; branches: string[] }>(
      `/api/v1/git/branches?${params.toString()}`,
    );
  }

  async getDiff(
    projectPath: string,
    filePath?: string,
    staged?: boolean,
  ): Promise<string> {
    const params = new URLSearchParams({ projectPath });
    if (filePath) params.set('filePath', filePath);
    if (staged != null) params.set('staged', String(staged));
    const res = await apiRequest<{ diff?: string } | string>(
      `/api/v1/git/diff?${params.toString()}`,
    );
    if (typeof res === 'string') return res;
    return res?.diff || '';
  }

  async stageFiles(files: string[], projectPath?: string): Promise<void> {
    return apiRequest<void>('/api/v1/git/stage', {
      method: 'POST',
      body: { projectPath, files },
      retries: 0,
    });
  }

  async unstageFiles(files: string[], projectPath?: string): Promise<void> {
    return apiRequest<void>('/api/v1/git/unstage', {
      method: 'POST',
      body: { projectPath, files },
      retries: 0,
    });
  }

  async commit(req: GitCommitRequest): Promise<GitCommitResponse> {
    return apiRequest<GitCommitResponse>('/api/v1/git/commit', {
      method: 'POST',
      body: req,
      retries: 0,
    });
  }

  async push(branch?: string, projectPath?: string): Promise<GitPushPullResponse> {
    return apiRequest<GitPushPullResponse>('/api/v1/git/push', {
      method: 'POST',
      body: { projectPath, ...(branch ? { branch } : {}) },
      timeoutMs: 30_000,
      retries: 0,
    });
  }

  async pull(branch?: string, projectPath?: string): Promise<GitPushPullResponse> {
    return apiRequest<GitPushPullResponse>('/api/v1/git/pull', {
      method: 'POST',
      body: { projectPath, ...(branch ? { branch } : {}) },
      timeoutMs: 30_000,
      retries: 0,
    });
  }

  async switchBranch(
    branchName: string,
    projectPath?: string,
    createNew: boolean = false,
  ): Promise<void> {
    return apiRequest<void>('/api/v1/git/checkout', {
      method: 'POST',
      body: { projectPath, branchName, createNew },
      retries: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// 6. CLI Service
// ---------------------------------------------------------------------------

class RealCliService implements ICliService {
  async listTools(): Promise<AiCliTool[]> {
    const res = await apiRequest<any>('/api/v1/cli/tools');
    const rawList: any[] = Array.isArray(res) ? res : Array.isArray(res?.tools) ? res.tools : [];
    return rawList.map((item) => {
      const installed = Boolean(item.isInstalled || item.status === 'installed');
      const authStatus =
        item.authStatus || (installed ? 'unknown' : 'not_installed');
      let status: AiCliTool['status'] = installed ? 'installed' : 'unavailable';
      if (installed && authStatus === 'unauthenticated') {
        status = 'needs_setup';
      }
      return {
        id: item.id,
        name: item.name,
        cliName: item.cliName || item.id,
        vendor: item.vendor || item.provider || 'CLI Provider',
        description: item.description || '',
        status,
        version: item.version || (installed ? 'Installed' : 'Not Installed'),
        installCommand: item.installCommand || '',
        installScope: item.installScope || 'user',
        runCommand: item.runCommand || item.cliName || item.id,
        permissionsRequired: Array.isArray(item.permissionsRequired) ? item.permissionsRequired : [],
        capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
        executablePath: item.executablePath || item.path || undefined,
        authStatus,
        authDetail: item.authDetail || undefined,
        launchSupported: item.launchSupported !== false,
      };
    });
  }

  async installTool(toolId: string): Promise<InstallToolResponse> {
    const res = await apiRequest<any>('/api/v1/cli/install', {
      method: 'POST',
      body: { toolId },
      timeoutMs: 120_000,
      retries: 0,
    });
    return {
      toolId: res.toolId || toolId,
      success: Boolean(res.success),
      installedVersion: res.installedVersion || res.version || '',
      outputLog: res.outputLog || '',
    };
  }

  async checkCliStatus(cliName: string): Promise<CliStatusResponse> {
    const params = new URLSearchParams({ name: cliName });
    return apiRequest<CliStatusResponse>(`/api/v1/cli/check?${params.toString()}`);
  }
}

// ---------------------------------------------------------------------------
// 7. Preview Service
// ---------------------------------------------------------------------------

class RealPreviewService implements IPreviewService {
  async listDevServers(): Promise<DevServer[]> {
    const res = await apiRequest<DevServer[] | { ports?: DevServer[] }>('/api/v1/preview/servers');
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.ports)) return res.ports;
    return [];
  }

  async startDevServer(command: string, port: number, workingDir?: string): Promise<DevServer> {
    return apiRequest<DevServer>('/api/v1/preview/servers/start', {
      method: 'POST',
      body: { command, port, workingDir },
      retries: 0,
    });
  }

  async stopDevServer(serverId: string): Promise<void> {
    return apiRequest<void>('/api/v1/preview/servers/stop', {
      method: 'POST',
      body: { serverId },
      retries: 0,
    });
  }

  async runPythonPreview(scriptPath: string): Promise<PythonPreviewResponse> {
    return apiRequest<PythonPreviewResponse>('/api/v1/preview/python/run', {
      method: 'POST',
      body: { scriptPath },
      timeoutMs: 60_000,
      retries: 0,
    });
  }

  async getDesktopAppStream(appId: string): Promise<DesktopAppStreamInfo> {
    return apiRequest<DesktopAppStreamInfo>(
      `/api/v1/preview/desktop-stream?appId=${encodeURIComponent(appId)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 8. Sync Service
// ---------------------------------------------------------------------------

class RealSyncService implements ISyncService {
  async queueIntent(
    intent: Omit<CommandIntent, 'id' | 'seq' | 'timestamp' | 'status'>,
  ): Promise<CommandIntent> {
    return enqueueIntent(intent);
  }

  async listQueuedIntents(): Promise<CommandIntent[]> {
    return listIntents();
  }

  async reconcileIntent(
    id: string,
    action: 'run' | 'skip' | 'cancel',
  ): Promise<ReconciliationResult> {
    return apiRequest<ReconciliationResult>('/api/v1/sync/reconcile-single', {
      method: 'POST',
      body: { intentId: id, action },
      timeoutMs: 30_000,
      retries: 0,
    });
  }

  async reconcileAll(forceRun?: boolean): Promise<ReconciliationSummary> {
    return apiRequest<ReconciliationSummary>('/api/v1/sync/reconcile-all', {
      method: 'POST',
      body: { forceRun: forceRun ?? false },
      timeoutMs: 120_000,
      retries: 0,
    });
  }

  async triggerCloudFallback(_intentIds: string[]): Promise<CloudExecutionResponse> {
    throw new ApiError(
      'Cloud execution is not available in the current release. All operations run on the local PC.',
      501,
      'CLOUD_DISABLED',
    );
  }
}
