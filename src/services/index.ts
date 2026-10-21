import { IRelayBackendAdapter } from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';
import { RealRelayBackendAdapter } from './realBackendAdapter';

export * from './contracts';
export * from './mockAdapter';
export * from './mockDaemon';
export * from './httpServices';
export * from './realBackendAdapter';

/**
 * Global singleton adapter instance.
 * Automatically initializes RealRelayBackendAdapter when running against the host companion,
 * and allows easy switching.
 */
let activeAdapter: IRelayBackendAdapter = new RealRelayBackendAdapter();

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
