import {
  IRelayBackendAdapter,
  IAuthService,
  IFileSystemService,
  IGitService,
  ICliService,
  IPreviewService,
  ISyncService,
} from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';
import { HttpFileSystemService, HttpGitService } from './httpServices';
import { WindowsHostConnectionClient, WindowsHostTerminalClient } from './hostClientAdapter';

/**
 * Real Backend Adapter connecting Subsystems 1-5 (Host/Pairing/Terminal, Filesystem, Git)
 * to the live Windows host companion daemon over REST.
 */
export class RealRelayBackendAdapter implements IRelayBackendAdapter {
  readonly isMock = false;
  readonly adapterName = 'Real Windows Host Companion Adapter';
  readonly backendEndpoint: string;

  auth: IAuthService;
  connection: WindowsHostConnectionClient;
  terminal: WindowsHostTerminalClient;
  fileSystem: IFileSystemService;
  git: IGitService;
  cli: ICliService;
  preview: IPreviewService;
  sync: ISyncService;

  constructor(hostBaseUrl?: string) {
    const fallback = new MockRelayBackendAdapter();
    const defaultEndpoint =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://127.0.0.1:3000';
    this.backendEndpoint = hostBaseUrl || defaultEndpoint;

    this.auth = fallback.auth;
    this.connection = new WindowsHostConnectionClient(this.backendEndpoint);
    this.terminal = new WindowsHostTerminalClient(this.backendEndpoint, this.connection);
    this.fileSystem = new HttpFileSystemService(this.backendEndpoint);
    this.git = new HttpGitService(this.backendEndpoint);
    this.cli = fallback.cli;
    this.preview = fallback.preview;
    this.sync = fallback.sync;
  }
}
