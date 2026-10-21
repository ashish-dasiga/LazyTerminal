import { IRelayBackendAdapter } from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';
import { WindowsHostBackendAdapter } from './hostClientAdapter';

export * from './contracts';
export * from './mockAdapter';
export * from './mockDaemon';
export * from './hostClientAdapter';

/**
 * Global singleton adapter instance.
 * Defaults to `WindowsHostBackendAdapter` to connect pairing, host status,
 * and persistent terminal sessions to the local Windows PC companion.
 */
let activeAdapter: IRelayBackendAdapter = new WindowsHostBackendAdapter();

export function getBackendAdapter(): IRelayBackendAdapter {
  return activeAdapter;
}

export function setBackendAdapter(adapter: IRelayBackendAdapter): void {
  activeAdapter = adapter;
}
