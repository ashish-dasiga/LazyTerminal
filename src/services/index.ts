import { IRelayBackendAdapter } from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';
import { RealRelayBackendAdapter } from './realAdapter';
import { getAppConfig } from './config';

export * from './contracts';
export * from './mockAdapter';
export * from './mockDaemon';
export * from './hostClientAdapter';
export * from './httpServices';
export * from './realAdapter';
export * from './config';
export * from './apiClient';
export * from './offlineQueue';
export * from './connectionMonitor';

/**
 * Global singleton adapter instance.
 *
 * Defaults to RealRelayBackendAdapter when running against the host companion,
 * and allows easy switching.
 */
function createAdapter(): IRelayBackendAdapter {
  const config = getAppConfig();
  return new RealRelayBackendAdapter(config.hostBaseUrl);
}

let activeAdapter: IRelayBackendAdapter = createAdapter();

export function getBackendAdapter(): IRelayBackendAdapter {
  return activeAdapter;
}

export function setBackendAdapter(adapter: IRelayBackendAdapter): void {
  activeAdapter = adapter;
}

export function useMockAdapter(): void {
  activeAdapter = new MockRelayBackendAdapter();
}

export function useRealAdapter(hostUrl?: string): void {
  activeAdapter = new RealRelayBackendAdapter(hostUrl);
}

export function reinitializeAdapter(): IRelayBackendAdapter {
  activeAdapter = createAdapter();
  return activeAdapter;
}
