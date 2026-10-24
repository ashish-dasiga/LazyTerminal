/**
 * Lazy Terminal Ã¢â‚¬â€ Real backend adapter for the Windows PC companion.
 *
 * Implements `IRelayBackendAdapter` by making actual HTTP/WS calls to the
 * PC host APIs.  When a PC-side API is not yet implemented (Ashish,
 * Ashritha, Shreya branches), methods fail fast with clear error messages
 * instead of returning fake success.
 *
 * @module realAdapter
 */

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
  CloudExecutionResponse,
} from './contracts';
import {
  CommandIntent,
  DeviceInfo,
  DevServer,
  ProjectFile,
  TerminalSession,
  UserAccount,
  AiCliTool,
} from '../types/relay';
import { apiRequest, setSessionToken, HostUnreachableError, ApiError } from './apiClient';
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
    this.terminal = new RealTerminalService();
    this.fileSystem = new RealFileSystemService();
    this.git = new RealGitService();
    this.cli = new RealCliService();
    this.preview = new RealPreviewService();
    this.sync = new RealSyncService();
  }
}

// ---------------------------------------------------------------------------
// 1. Auth Service Ã¢â‚¬â€ real HTTP calls
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

  async getHostDeviceInfo(): Promise<DeviceInfo> {
    return apiRequest<DeviceInfo>('/api/v1/host/status');
  }

  async setHostServerStatus(status: 'start' | 'stop' | 'restart'): Promise<HostServerStatusResponse> {
    return apiRequest<HostServerStatusResponse>('/api/v1/host/daemon/control', {
      method: 'POST',
      body: { status },
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Terminal & PTY Service
// ---------------------------------------------------------------------------

class RealTerminalService implements ITerminalService {
  async listSessions(): Promise<TerminalSession[]> {
    return apiRequest<TerminalSession[]>('/api/v1/pty/sessions');
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
        timeoutMs: 30_000, // commands may take longer
      },
    );
  }

  async sendSignal(req: SendSignalRequest): Promise<void> {
    return apiRequest<void>(
      `/api/v1/pty/sessions/${encodeURIComponent(req.sessionId)}/signal`,
      {
        method: 'POST',
        body: { signal: req.signal },
      },
    );
  }
}

// ---------------------------------------------------------------------------
// 4. File System Service
// ---------------------------------------------------------------------------

class RealFileSystemService implements IFileSystemService {
  async listFiles(req: ListFilesRequest): Promise<ProjectFile[]> {
    const params = new URLSearchParams({ projectPath: req.projectPath, dir: req.projectPath });
    if (req.subDirectory) { params.set('subDirectory', req.subDirectory); params.set('subdir', req.subDirectory); }
    const res = await apiRequest<{ files?: ProjectFile[] } | ProjectFile[]>(`/api/v1/fs/list?${params}`);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).files)) return (res as any).files;
    return [];
  }

  async readFile(req: ReadFileRequest): Promise<ReadFileResponse> {
    const projectPath = (req as any).projectPath || '';
    const params = new URLSearchParams({ filePath: req.filePath, path: req.filePath, projectPath, dir: projectPath });
    return apiRequest<ReadFileResponse>(`/api/v1/fs/read?${params}`);
  }

  async writeFile(req: WriteFileRequest): Promise<WriteFileResponse> {
    return apiRequest<WriteFileResponse>('/api/v1/fs/write', {
      method: 'POST',
      body: req,
    });
  }

  async createFile(req: CreateFileRequest): Promise<ProjectFile> {
    return apiRequest<ProjectFile>('/api/v1/fs/create', {
      method: 'POST',
      body: req,
    });
  }

  async deleteFile(req: DeleteFileRequest): Promise<void> {
    return apiRequest<void>('/api/v1/fs/delete', {
      method: 'DELETE',
      body: req,
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Git Service
// ---------------------------------------------------------------------------

class RealGitService implements IGitService {
  async getStatus(projectPath: string): Promise<GitStatusResponse> {
    const params = new URLSearchParams({ projectPath, project: projectPath, dir: projectPath });
    return apiRequest<GitStatusResponse>(`/api/v1/git/status?${params}`);
  }

  async stageFiles(files: string[]): Promise<void> {
    return apiRequest<void>('/api/v1/git/stage', {
      method: 'POST',
      body: { files },
    });
  }

  async unstageFiles(files: string[]): Promise<void> {
    return apiRequest<void>('/api/v1/git/unstage', {
      method: 'POST',
      body: { files },
    });
  }

  async commit(req: GitCommitRequest): Promise<GitCommitResponse> {
    return apiRequest<GitCommitResponse>('/api/v1/git/commit', {
      method: 'POST',
      body: req,
    });
  }

  async push(branch?: string): Promise<GitPushPullResponse> {
    return apiRequest<GitPushPullResponse>('/api/v1/git/push', {
      method: 'POST',
      body: branch ? { branch } : {},
      timeoutMs: 30_000,
    });
  }

  async pull(branch?: string): Promise<GitPushPullResponse> {
    return apiRequest<GitPushPullResponse>('/api/v1/git/pull', {
      method: 'POST',
      body: branch ? { branch } : {},
      timeoutMs: 30_000,
    });
  }

  async switchBranch(branchName: string): Promise<void> {
    return apiRequest<void>('/api/v1/git/checkout', {
      method: 'POST',
      body: { branch: branchName },
    });
  }
}

// ---------------------------------------------------------------------------
// 6. CLI Service
// ---------------------------------------------------------------------------

class RealCliService implements ICliService {
  async listTools(): Promise<AiCliTool[]> {
    return apiRequest<AiCliTool[]>('/api/v1/cli/tools');
  }

  async installTool(toolId: string): Promise<InstallToolResponse> {
    return apiRequest<InstallToolResponse>('/api/v1/cli/install', {
      method: 'POST',
      body: { toolId },
      timeoutMs: 120_000, // installs can be slow
    });
  }

  async checkCliStatus(cliName: string): Promise<CliStatusResponse> {
    const params = new URLSearchParams({ name: cliName });
    return apiRequest<CliStatusResponse>(`/api/v1/cli/check?${params}`);
  }
}

// ---------------------------------------------------------------------------
// 7. Preview Service
// ---------------------------------------------------------------------------

class RealPreviewService implements IPreviewService {
  async listDevServers(): Promise<DevServer[]> {
    return apiRequest<DevServer[]>('/api/v1/preview/servers');
  }

  async startDevServer(command: string, port: number): Promise<DevServer> {
    return apiRequest<DevServer>('/api/v1/preview/servers/start', {
      method: 'POST',
      body: { command, port },
    });
  }

  async stopDevServer(serverId: string): Promise<void> {
    return apiRequest<void>('/api/v1/preview/servers/stop', {
      method: 'POST',
      body: { serverId },
    });
  }

  async runPythonPreview(scriptPath: string): Promise<PythonPreviewResponse> {
    return apiRequest<PythonPreviewResponse>('/api/v1/preview/python/run', {
      method: 'POST',
      body: { scriptPath },
      timeoutMs: 60_000,
    });
  }

  async getDesktopAppStream(appId: string): Promise<DesktopAppStreamInfo> {
    return apiRequest<DesktopAppStreamInfo>(
      `/api/v1/preview/desktop/${encodeURIComponent(appId)}`,
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
    });
  }

  async reconcileAll(forceRun?: boolean): Promise<ReconciliationSummary> {
    return apiRequest<ReconciliationSummary>('/api/v1/sync/reconcile-all', {
      method: 'POST',
      body: { forceRun: forceRun ?? false },
      timeoutMs: 120_000,
    });
  }

  async triggerCloudFallback(_intentIds: string[]): Promise<CloudExecutionResponse> {
    // Cloud execution is explicitly deferred for MVP
    throw new ApiError(
      'Cloud execution is not available in the current release. All operations run on the local PC.',
      501,
      'CLOUD_DISABLED',
    );
  }
}
