import { IRelayBackendAdapter } from './contracts';
import { MockRelayBackendAdapter } from './mockAdapter';

export * from './contracts';
export * from './mockAdapter';
export * from './mockDaemon';

/**
 * Global singleton adapter instance.
 * By default, this runs `MockRelayBackendAdapter` for browser testing and rapid prototyping.
 * 
 * TO PLUG IN YOUR REAL BACKEND:
 * 1. Implement `RealRelayBackendAdapter` matching `IRelayBackendAdapter`.
 * 2. Replace the instance below:
 *    `let activeAdapter: IRelayBackendAdapter = new RealRelayBackendAdapter('wss://your-host-ip:9871');`
 */
let activeAdapter: IRelayBackendAdapter = new MockRelayBackendAdapter();

export function getBackendAdapter(): IRelayBackendAdapter {
  return activeAdapter;
}

export function setBackendAdapter(adapter: IRelayBackendAdapter): void {
  activeAdapter = adapter;
}
