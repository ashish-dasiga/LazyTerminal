/**
 * Tests for Deeksha workstream:
 * - Config & adapter mode selection
 * - API client error handling & classification
 * - Real adapter contracts & error states
 * - Connection monitor transitions & stale detection
 * - Offline queue sequencing & deduplication
 */

import assert from 'node:assert';
import test from 'node:test';
import { getAppConfig, setAdapterMode, setHostUrl } from '../services/config';
import { ApiError, HostUnreachableError, setSessionToken, getSessionToken } from '../services/apiClient';
import { RealRelayBackendAdapter } from '../services/realAdapter';
import {
  getConnectionStatus,
  markConnected,
  markDisconnected,
  recordSuccessfulContact,
  recordFailedContact,
  isDataStale,
  isConnected,
  onConnectionChange,
} from '../services/connectionMonitor';

test('Config: default configuration provides safe defaults', () => {
  const config = getAppConfig();
  assert.ok(config.hostBaseUrl, 'Should have a hostBaseUrl');
  assert.ok(config.hostWsUrl.startsWith('ws'), 'WS URL should start with ws or wss');
  assert.strictEqual(typeof config.requestTimeoutMs, 'number');
  assert.strictEqual(typeof config.maxRetries, 'number');
});

test('Config: mode and host setters update configuration', () => {
  setAdapterMode('real');
  setHostUrl('http://192.168.1.50:9871');
  const config = getAppConfig();
  assert.strictEqual(config.adapterMode, 'real');
  assert.strictEqual(config.hostBaseUrl, 'http://192.168.1.50:9871');
  assert.strictEqual(config.hostWsUrl, 'ws://192.168.1.50:9871/ws');

  // Reset back to mock
  setAdapterMode('mock');
  assert.strictEqual(getAppConfig().adapterMode, 'mock');
});

test('API Client: session token management', () => {
  setSessionToken('test-token-xyz');
  assert.strictEqual(getSessionToken(), 'test-token-xyz');
  setSessionToken(null);
  assert.strictEqual(getSessionToken(), null);
});

test('API Client: error classification', () => {
  const err404 = new ApiError('Not found', 404, 'HTTP_404', false);
  assert.strictEqual(err404.status, 404);
  assert.strictEqual(err404.code, 'HTTP_404');
  assert.strictEqual(err404.isOffline, false);

  const unreachable = new HostUnreachableError();
  assert.strictEqual(unreachable.code, 'HOST_UNREACHABLE');
  assert.strictEqual(unreachable.status, 0);
  assert.strictEqual(unreachable.isOffline, true);
  assert.ok(unreachable.message.includes('unreachable'));
});

test('Real Adapter: implements IRelayBackendAdapter contract', () => {
  const adapter = new RealRelayBackendAdapter('http://localhost:9871');
  assert.strictEqual(adapter.isMock, false);
  assert.strictEqual(adapter.backendEndpoint, 'http://localhost:9871');
  assert.ok(adapter.auth, 'Must have auth service');
  assert.ok(adapter.connection, 'Must have connection service');
  assert.ok(adapter.terminal, 'Must have terminal service');
  assert.ok(adapter.fileSystem, 'Must have fileSystem service');
  assert.ok(adapter.git, 'Must have git service');
  assert.ok(adapter.cli, 'Must have cli service');
  assert.ok(adapter.preview, 'Must have preview service');
  assert.ok(adapter.sync, 'Must have sync service');
});

test('Real Adapter: deferred cloud execution throws CLOUD_DISABLED', async () => {
  const adapter = new RealRelayBackendAdapter('http://localhost:9871');
  await assert.rejects(
    async () => {
      await adapter.sync.triggerCloudFallback(['intent-1']);
    },
    (err: any) => {
      assert.strictEqual(err.code, 'CLOUD_DISABLED');
      assert.strictEqual(err.status, 501);
      return true;
    }
  );
});

test('Connection Monitor: transitions and stale data detection', () => {
  // Test mark connected
  markConnected();
  let status = getConnectionStatus();
  assert.strictEqual(status.state, 'connected');
  assert.strictEqual(status.isDataStale, false);
  assert.strictEqual(isConnected(), true);

  // Test mark disconnected
  markDisconnected('Lost WiFi');
  status = getConnectionStatus();
  assert.strictEqual(status.state, 'disconnected');
  assert.strictEqual(status.isDataStale, true);
  assert.strictEqual(isConnected(), false);
  assert.strictEqual(isDataStale(), true);

  // Test failed contact thresholds (1 fail = reconnecting, 3 fails = disconnected)
  recordSuccessfulContact();
  assert.strictEqual(isConnected(), true);

  recordFailedContact('Timeout 1');
  status = getConnectionStatus();
  assert.strictEqual(status.state, 'reconnecting');
  assert.strictEqual(status.failedChecks, 1);

  recordFailedContact('Timeout 2');
  recordFailedContact('Timeout 3');
  status = getConnectionStatus();
  assert.strictEqual(status.state, 'disconnected');
  assert.strictEqual(status.failedChecks, 3);
  assert.strictEqual(isDataStale(), true);
});

test('Connection Monitor: listener subscriptions receive updates', () => {
  const received: string[] = [];
  const unsub = onConnectionChange((s) => {
    received.push(s.state);
  });

  markConnected();
  markDisconnected('test');

  unsub();
  markConnected(); // should not be received after unsub

  assert.ok(received.length >= 2);
  assert.strictEqual(received[received.length - 1], 'disconnected');
});
