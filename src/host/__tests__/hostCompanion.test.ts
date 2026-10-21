import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { startHostCompanionServer, RunningHostServer } from '../companionServer';
import { WindowsHostBackendAdapter } from '../../services/hostClientAdapter';
import { PairingManager } from '../pairingManager';
import { loadHostConfig } from '../config';
import { createHostLogger } from '../logger';

describe('Lazy Terminal — Windows Host Companion & Terminal Sessions', () => {
  let hostServer: RunningHostServer;
  let baseUrl: string;

  before(async () => {
    hostServer = await startHostCompanionServer(
      {
        hostPort: 0, // bind to ephemeral available port for isolated testing
        hostBind: '127.0.0.1',
        defaultWorkspaceRoot: process.cwd(),
        allowedRoots: [process.cwd()],
        pairingTtlSeconds: 300,
        pairingMaxAttempts: 4,
        pairingLockoutMs: 10_000,
        commandTimeoutMs: 10_000,
      },
      { silentLogger: true }
    );
    baseUrl = `http://127.0.0.1:${hostServer.port}`;
  });

  after(async () => {
    if (hostServer) {
      await hostServer.close();
    }
  });

  it('generates a fresh 6-digit pairing key on startup and redacts secrets from logs', () => {
    const keyInfo = hostServer.companion.pairing.getCurrentKeyEnvelope();
    assert.match(keyInfo.pairingKey, /^\d{3}-\d{3}$/);
    assert.ok(keyInfo.expiresInSeconds > 0);

    // Log a message containing a secret and verify redaction
    hostServer.companion.logger.info(`Test log with key ${keyInfo.pairingKey}`, {
      pairingKey: keyInfo.pairingKey,
      sessionToken: 'lt_sess_secret123',
    });

    const logs = JSON.stringify(hostServer.companion.logger.getEntries());
    assert.ok(!logs.includes(keyInfo.pairingKey), 'Pairing key must never appear in logs');
    assert.ok(!logs.includes('lt_sess_secret123'), 'Session token must never appear in logs');
  });

  it('rejects unauthenticated requests to terminal and host status endpoints with 401', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/v1/pty/sessions' },
      { method: 'POST', path: '/api/v1/pty/sessions/sess-pwsh/input', body: { command: 'whoami' } },
      { method: 'GET', path: '/api/v1/host/status' },
      { method: 'POST', path: '/api/v1/tunnel/disconnect' },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert.equal(res.status, 401, `Expected 401 for unauthenticated ${ep.method} ${ep.path}`);
      const data = await res.json();
      assert.equal(data.error?.code, 'AUTH_REQUIRED');
    }
  });

  it('enforces pairing key validation, expiry, and brute-force rate limiting', () => {
    let fakeNow = 1_000_000;
    const cfg = {
      ...loadHostConfig(),
      pairingTtlSeconds: 60,
      pairingMaxAttempts: 3,
      pairingLockoutMs: 30_000,
    };
    const logger = createHostLogger({ silent: true });
    const pm = new PairingManager(cfg, logger, { nowFn: () => fakeNow });

    const initialKey = pm.getCurrentKeyEnvelope().pairingKey;
    assert.match(initialKey, /^\d{3}-\d{3}$/);

    // 1. Invalid key attempts trigger rate limit after 3 failures
    assert.equal(pm.validatePairingKey({ pairingKey: '000-000' }).isValid, false);
    assert.equal(pm.validatePairingKey({ pairingKey: '000-001' }).isValid, false);
    const thirdFail = pm.validatePairingKey({ pairingKey: '000-002' });
    assert.equal(thirdFail.isValid, false);
    assert.match(thirdFail.errorMessage || '', /Too many failed pairing attempts/);

    // Even valid key is blocked while locked out
    const blockedValid = pm.validatePairingKey({ pairingKey: initialKey });
    assert.equal(blockedValid.isValid, false);

    // 2. Rotating key clears lockout and invalidates old key
    const rotated = pm.rotatePairingKey('test_rotate');
    assert.notEqual(rotated.pairingKey, initialKey);
    assert.equal(pm.validatePairingKey({ pairingKey: initialKey }).isValid, false);
    assert.equal(pm.validatePairingKey({ pairingKey: rotated.pairingKey }).isValid, true);

    // 3. Advancing clock past TTL expires key
    fakeNow += 61_000;
    const expiredRes = pm.validatePairingKey({ pairingKey: rotated.pairingKey });
    assert.equal(expiredRes.isValid, false);
    assert.match(expiredRes.errorMessage || '', /expired/i);
  });

  it('pairs via WindowsHostBackendAdapter and executes real persistent PowerShell commands', async () => {
    const adapter = new WindowsHostBackendAdapter(baseUrl);
    const keyEnvelope = await adapter.connection.fetchActiveHostKey();

    // 1. Wrong key fails pairing
    const badConnect = await adapter.connection.connectToHost({ pairingKey: '000-000' });
    assert.equal(badConnect.success, false);

    // 2. Valid key establishes authenticated session
    const goodConnect = await adapter.connection.connectToHost({
      pairingKey: keyEnvelope.pairingKey,
    });
    assert.equal(goodConnect.success, true);
    assert.ok(goodConnect.sessionToken.startsWith('lt_sess_'));
    assert.equal(goodConnect.device.isOnline, true);

    // 3. Execute harmless command and verify real output
    const exec1 = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Write-Output "LAZY_TERMINAL_REAL_HOST_OK"',
      workingDir: process.cwd(),
    });
    assert.equal(exec1.exitCode, 0);
    const combinedOut1 = exec1.lines.map((l) => l.content).join('\n');
    assert.ok(
      combinedOut1.includes('LAZY_TERMINAL_REAL_HOST_OK'),
      `Expected real output, got: ${combinedOut1}`
    );

    // 4. Verify persistent state (variable + working directory) across commands in same session
    await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: '$ltPersistVar = "PERSISTED_VALUE_99"; Set-Location src',
      workingDir: process.cwd(),
    });

    const exec2 = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Write-Output "$ltPersistVar|$((Get-Location).Path)"',
      workingDir: process.cwd(),
    });
    assert.equal(exec2.exitCode, 0);
    const combinedOut2 = exec2.lines.map((l) => l.content).join('\n');
    assert.ok(combinedOut2.includes('PERSISTED_VALUE_99'));
    assert.ok(
      combinedOut2.toLowerCase().includes(path.join(process.cwd(), 'src').toLowerCase())
    );

    // Return to workspace root
    await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: `Set-Location -LiteralPath '${process.cwd().replace(/'/g, "''")}'`,
      workingDir: process.cwd(),
    });
  });

  it('blocks unauthorized working directories and destructive commands', async () => {
    const adapter = new WindowsHostBackendAdapter(baseUrl);
    const keyEnvelope = await adapter.connection.fetchActiveHostKey();
    await adapter.connection.connectToHost({ pairingKey: keyEnvelope.pairingKey });

    // 1. Unauthorized working directory outside workspace root
    const unauthorizedDirRes = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Write-Output "should-not-run"',
      workingDir: 'C:\\Windows\\System32',
    });
    assert.equal(unauthorizedDirRes.exitCode, 126);
    assert.match(unauthorizedDirRes.lines[0]?.content || '', /outside authorized workspace roots/i);

    // 2. Destructive command blocked by command guard
    const dangerousCmdRes = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Stop-Computer -Force',
      workingDir: process.cwd(),
    });
    assert.equal(dangerousCmdRes.exitCode, 126);
    assert.match(dangerousCmdRes.lines[0]?.content || '', /SECURITY GUARD/);

    // 3. In-shell directory traversal outside allowed root is reverted
    const escapeRes = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Set-Location C:\\Windows',
      workingDir: process.cwd(),
    });
    const escapeText = escapeRes.lines.map((l) => l.content).join('\n');
    assert.match(escapeText, /blocked: outside authorized workspace roots/i);
    assert.equal(
      escapeRes.workingDir?.toLowerCase(),
      process.cwd().toLowerCase()
    );
  });

  it('handles SIGINT cancellation and daemon restart secret invalidation', async () => {
    const adapter = new WindowsHostBackendAdapter(baseUrl);
    const key1 = (await adapter.connection.fetchActiveHostKey()).pairingKey;
    await adapter.connection.connectToHost({ pairingKey: key1 });

    // Start a slow command and cancel it via SIGINT
    const slowPromise = adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Start-Sleep -Seconds 8; Write-Output "FINISHED_SLOW"',
      workingDir: process.cwd(),
    });

    await new Promise((r) => setTimeout(r, 300));
    await adapter.terminal.sendSignal({ sessionId: 'sess-pwsh', signal: 'SIGINT' });

    const slowRes = await slowPromise;
    assert.equal(slowRes.exitCode, 130);
    const slowText = slowRes.lines.map((l) => l.content).join('\n');
    assert.ok(!slowText.includes('FINISHED_SLOW'));

    // Restarting daemon invalidates old pairing key and active session token
    await adapter.connection.setHostServerStatus('restart');
    const key2 = (await adapter.connection.fetchActiveHostKey()).pairingKey;
    assert.notEqual(key2, key1);

    // Old key must be rejected after restart
    const oldKeyConnect = await adapter.connection.connectToHost({ pairingKey: key1 });
    assert.equal(oldKeyConnect.success, false);

    // New key succeeds
    const newKeyConnect = await adapter.connection.connectToHost({ pairingKey: key2 });
    assert.equal(newKeyConnect.success, true);
  });

  it('streams real-time terminal output over SSE (/api/v1/pty/sessions/:id/stream)', async () => {
    const adapter = new WindowsHostBackendAdapter(baseUrl);
    const keyEnvelope = await adapter.connection.fetchActiveHostKey();
    const conn = await adapter.connection.connectToHost({
      pairingKey: keyEnvelope.pairingKey,
    });
    assert.equal(conn.success, true);

    const abortController = new AbortController();
    const sseEvents: string[] = [];

    const streamPromise = (async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/pty/sessions/sess-pwsh/stream`,
        {
          headers: { Authorization: `Bearer ${conn.sessionToken}` },
          signal: abortController.signal,
        }
      );
      assert.equal(res.status, 200);
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseEvents.push(decoder.decode(value));
          if (sseEvents.join('').includes('SSE_STREAM_TEST_OK')) {
            abortController.abort();
            break;
          }
        }
      } catch {
        // Expected on abort
      }
    })();

    await new Promise((r) => setTimeout(r, 150));
    const execRes = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Write-Output "SSE_STREAM_TEST_OK"',
      workingDir: process.cwd(),
    });
    assert.equal(execRes.exitCode, 0);

    await streamPromise;
    assert.ok(
      sseEvents.join('').includes('SSE_STREAM_TEST_OK'),
      'Expected SSE stream to receive real-time terminal output line'
    );
  });
});
