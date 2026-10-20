import {
  ConnectHostRequest,
  ConnectHostResponse,
  CreateSessionRequest,
  ExecuteCommandRequest,
  ExecuteCommandResponse,
  GenerateKeyResponse,
  HostServerStatusResponse,
  IAuthService,
  ICliService,
  IConnectionService,
  IFileSystemService,
  IGitService,
  IPreviewService,
  IRelayBackendAdapter,
  ISyncService,
  ITerminalService,
  SendSignalRequest,
  ValidateKeyRequest,
  ValidateKeyResponse,
} from './contracts';
import { DeviceInfo, TerminalSession } from '../types/relay';
import { MockRelayBackendAdapter } from './mockAdapter';

function resolveDefaultHostEndpoint(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> })?.env;
  if (metaEnv?.VITE_HOST_API_URL) {
    return metaEnv.VITE_HOST_API_URL.replace(/\/+$/, '');
  }
  if (typeof process !== 'undefined' && process.env?.VITE_HOST_API_URL) {
    return process.env.VITE_HOST_API_URL.replace(/\/+$/, '');
  }
  // When running in browser via Vite dev server or Express server, relative '/api/v1' works via proxy/mount;
  // fallback to http://127.0.0.1:9871 when running in Node tests.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:9871';
}

export class WindowsHostConnectionClient implements IConnectionService {
  private readonly baseUrl: string;
  private sessionToken: string = '';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public getSessionToken(): string {
    return this.sessionToken;
  }

  public setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  public getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {}),
    };
  }

  public async fetchActiveHostKey(): Promise<GenerateKeyResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/pairing/key`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Failed to fetch active pairing key (${res.status})`);
    }
    return res.json();
  }

  public async generateHostKey(): Promise<GenerateKeyResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/pairing/generate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Failed to generate pairing key (${res.status})`);
    }
    return res.json();
  }

  public async validatePairingKey(req: ValidateKeyRequest): Promise<ValidateKeyResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/pairing/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = (await res.json()) as ValidateKeyResponse;
      return data;
    } catch (err) {
      return {
        isValid: false,
        errorMessage:
          err instanceof Error
            ? `Windows host companion unreachable: ${err.message}`
            : 'Windows host companion unreachable.',
      };
    }
  }

  public async connectToHost(req: ConnectHostRequest): Promise<ConnectHostResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/tunnel/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = (await res.json()) as ConnectHostResponse;
      if (res.ok && data.success && data.sessionToken) {
        this.sessionToken = data.sessionToken;
      }
      return data;
    } catch (err) {
      throw new Error(
        err instanceof Error
          ? `Windows PC companion unreachable (${err.message})`
          : 'Windows PC companion unreachable'
      );
    }
  }

  public async disconnectHost(): Promise<void> {
    if (!this.sessionToken) return;
    try {
      await fetch(`${this.baseUrl}/api/v1/tunnel/disconnect`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } finally {
      this.sessionToken = '';
    }
  }

  public async getHostDeviceInfo(): Promise<DeviceInfo> {
    const res = await fetch(`${this.baseUrl}/api/v1/host/status`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Host status error (${res.status})`);
    }
    return res.json();
  }

  public async setHostServerStatus(
    status: 'start' | 'stop' | 'restart'
  ): Promise<HostServerStatusResponse & { pairingKey?: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/host/daemon/control`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Daemon control error (${res.status})`);
    }
    if (status === 'stop' || status === 'restart') {
      this.sessionToken = '';
    }
    return res.json();
  }
}

export class WindowsHostTerminalClient implements ITerminalService {
  private readonly baseUrl: string;
  private readonly connectionClient: WindowsHostConnectionClient;

  constructor(baseUrl: string, connectionClient: WindowsHostConnectionClient) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.connectionClient = connectionClient;
  }

  public async listSessions(): Promise<TerminalSession[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/pty/sessions`, {
      method: 'GET',
      headers: this.connectionClient.getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Failed to list sessions (${res.status})`);
    }
    return res.json();
  }

  public async createSession(req: CreateSessionRequest): Promise<TerminalSession> {
    const res = await fetch(`${this.baseUrl}/api/v1/pty/sessions`, {
      method: 'POST',
      headers: this.connectionClient.getAuthHeaders(),
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Failed to create session (${res.status})`);
    }
    return res.json();
  }

  public async closeSession(sessionId: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/pty/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'DELETE',
        headers: this.connectionClient.getAuthHeaders(),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Failed to close session (${res.status})`);
    }
  }

  public async executeCommand(
    req: ExecuteCommandRequest
  ): Promise<ExecuteCommandResponse & { workingDir?: string }> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/pty/sessions/${encodeURIComponent(req.sessionId)}/input`,
      {
        method: 'POST',
        headers: this.connectionClient.getAuthHeaders(),
        body: JSON.stringify(req),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body?.error?.message || `Terminal execution rejected (${res.status})`
      );
    }
    return res.json();
  }

  public async sendSignal(req: SendSignalRequest): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/pty/sessions/${encodeURIComponent(req.sessionId)}/signal`,
      {
        method: 'POST',
        headers: this.connectionClient.getAuthHeaders(),
        body: JSON.stringify(req),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `Failed to send signal (${res.status})`);
    }
  }
}

/**
 * Hybrid Backend Adapter for Ashish's branch (`ashish`):
 * - Connects `connection` (Pairing, Auth Session, Host Telemetry, Daemon Control)
 *   and `terminal` (Persistent Windows PowerShell/CMD/Bash sessions, signals, streaming)
 *   to the real Windows Host Companion over HTTP/REST + SSE.
 * - Retains clearly labelled mock fallbacks for other contributors' domains
 *   (`fileSystem`, `git`, `cli`, `preview`, `sync`, `auth`) until branch integration.
 */
export class WindowsHostBackendAdapter implements IRelayBackendAdapter {
  readonly isMock = false;
  readonly adapterName = 'Lazy Terminal Windows Host Adapter (Real Pairing + Terminal)';
  readonly backendEndpoint: string;

  readonly auth: IAuthService;
  readonly connection: WindowsHostConnectionClient;
  readonly terminal: WindowsHostTerminalClient;
  readonly fileSystem: IFileSystemService;
  readonly git: IGitService;
  readonly cli: ICliService;
  readonly preview: IPreviewService;
  readonly sync: ISyncService;

  constructor(endpointUrl: string = resolveDefaultHostEndpoint()) {
    this.backendEndpoint = endpointUrl;
    const mockFallback = new MockRelayBackendAdapter();

    this.connection = new WindowsHostConnectionClient(endpointUrl);
    this.terminal = new WindowsHostTerminalClient(endpointUrl, this.connection);

    // Other contributors' domains remain isolated mock stubs on this branch
    this.auth = mockFallback.auth;
    this.fileSystem = mockFallback.fileSystem;
    this.git = mockFallback.git;
    this.cli = mockFallback.cli;
    this.preview = mockFallback.preview;
    this.sync = mockFallback.sync;
  }
}
