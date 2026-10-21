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
} from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';
import { HttpFileSystemService, HttpGitService } from './httpServices';

/**
 * Real Backend Adapter connecting Subsystems 4 (Filesystem) and 5 (Git) to
 * the live Windows host companion daemon over authenticated REST.
 * Fallback services delegate to mock implementations for unassigned modules.
 */
export class RealRelayBackendAdapter implements IRelayBackendAdapter {
  readonly isMock = false;
  readonly adapterName = 'Real Windows Host Companion Adapter';
  readonly backendEndpoint: string;

  auth: IAuthService;
  connection: IConnectionService;
  terminal: ITerminalService;
  fileSystem: IFileSystemService;
  git: IGitService;
  cli: ICliService;
  preview: IPreviewService;
  sync: ISyncService;

  constructor(hostBaseUrl?: string) {
    const fallback = new MockRelayBackendAdapter();
    this.backendEndpoint = hostBaseUrl || 'http://127.0.0.1:3000';

    this.auth = fallback.auth;
    this.connection = fallback.connection;
    this.terminal = fallback.terminal;
    this.fileSystem = new HttpFileSystemService(this.backendEndpoint);
    this.git = new HttpGitService(this.backendEndpoint);
    this.cli = fallback.cli;
    this.preview = fallback.preview;
    this.sync = fallback.sync;
  }
}
