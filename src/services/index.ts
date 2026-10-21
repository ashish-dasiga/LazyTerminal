import { IRelayBackendAdapter } from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';
import { RealRelayBackendAdapter } from './realAdapter';
import { getAppConfig } from './config';

export * from './contracts';
export * from './mockAdapter';
export * from './mockDaemon';
export * from './realAdapter';
export * from './config';
export * from './apiClient';

/**
 * Global singleton adapter instance.
 *
 * Adapter mode is determined by configuration:
 * - Set VITE_ADAPTER_MODE=real in .env for real PC host connections
 * - Or call setAdapterMode('real') at runtime (persisted in localStorage)
 * - Default is 'mock' for safe development without a PC host
 *
 * The mock adapter remains available for UI development and testing.
 * The real adapter makes actual HTTP/WS calls to the Windows PC companion.
 */
function createAdapter(): IRelayBackendAdapter {
  const config = getAppConfig();
  if (config.adapterMode === 'real') {
    return new RealRelayBackendAdapter(config.hostBaseUrl);
  }
  return new MockRelayBackendAdapter();
}

let activeAdapter: IRelayBackendAdapter = createAdapter();

export function getBackendAdapter(): IRelayBackendAdapter {
  return activeAdapter;
}

export function setBackendAdapter(adapter: IRelayBackendAdapter): void {
  activeAdapter = adapter;
}

/**
 * Re-initialize the adapter based on current configuration.
 * Call after changing adapter mode or host URL via config setters.
 */
export function reinitializeAdapter(): IRelayBackendAdapter {
  activeAdapter = createAdapter();
  return activeAdapter;
}
