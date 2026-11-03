import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startHostCompanionServer, RunningHostServer } from '../companionServer';
import { WindowsHostBackendAdapter } from '../../services/hostClientAdapter';
import { PairingManager } from '../pairingManager';
import { loadHostConfig } from '../config';
import { createHostLogger } from '../logger';

describe('Lazy Terminal — Windows Host Companion & Terminal Sessions', () => {
  let hostServer: RunningHostServer;
  let baseUrl: string;

  let tempTestRoot: string;

  before(async () => {
    const rawTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-pwsh-suite-'));
    tempTestRoot = fs.realpathSync.native ? fs.realpathSync.native(rawTmp) : fs.realpathSync(rawTmp);
    hostServer = await startHostCompanionServer(
      {
        hostPort: 0,
        hostBind: '127.0.0.1',
        defaultWorkspaceRoot: process.cwd(),
        allowedRoots: [process.cwd(), tempTestRoot],
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
    if (tempTestRoot && fs.existsSync(tempTestRoot)) {
      fs.rmSync(tempTestRoot, { recursive: true, force: true });
    }
  });

  it('generates a fresh 6-digit pairing key on startup and redacts secrets from logs', () => {
    const keyInfo = hostServer.companion.pairing.getCurrentKeyEnvelope();
    assert.match(keyInfo.pairingKey, /^\d{3}-\d{3}$/);
    assert.ok(keyInfo.expiresInSeconds > 0);

    hostServer.companion.logger.info(`Test log with key ${keyInfo.pairingKey}`, {
      pairingKey: keyInfo.pairingKey,
      sessionToken: 'lt_sess_secret123',
    });

    const logs = JSON.stringify(hostServer.companion.logger.getEntries());
    assert.ok(!logs.includes(keyInfo.pairingKey), 'Pairing key must never appear in logs');
    assert.ok(!logs.includes('lt_sess_secret123'), 'Session token must never appear in logs');
  });

  it('rejects unauthenticated requests to terminal, filesystem, git, cli, and host status endpoints with 401', async () => {
    const endpoints = [
      { method: 'GET', path: '/api/v1/pty/sessions' },
      { method: 'POST', path: '/api/v1/pty/sessions/sess-pwsh/input', body: { command: 'whoami' } },
      { method: 'GET', path: '/api/v1/host/status' },
      { method: 'POST', path: '/api/v1/tunnel/disconnect' },
      { method: 'GET', path: `/api/v1/fs/list?projectPath=${encodeURIComponent(process.cwd())}` },
      { method: 'GET', path: `/api/v1/git/status?projectPath=${encodeURIComponent(process.cwd())}` },
      { method: 'GET', path: '/api/v1/cli/tools' },
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

    assert.equal(pm.validatePairingKey({ pairingKey: '000-000' }).isValid, false);
    assert.equal(pm.validatePairingKey({ pairingKey: '000-001' }).isValid, false);
    const thirdFail = pm.validatePairingKey({ pairingKey: '000-002' });
    assert.equal(thirdFail.isValid, false);
    assert.match(thirdFail.errorMessage || '', /Too many failed pairing attempts/);

    const blockedValid = pm.validatePairingKey({ pairingKey: initialKey });
    assert.equal(blockedValid.isValid, false);

    const rotated = pm.rotatePairingKey('test_rotate');
    assert.notEqual(rotated.pairingKey, initialKey);
    assert.equal(pm.validatePairingKey({ pairingKey: initialKey }).isValid, false);
    assert.equal(pm.validatePairingKey({ pairingKey: rotated.pairingKey }).isValid, true);

    fakeNow += 61_000;
    const expiredRes = pm.validatePairingKey({ pairingKey: rotated.pairingKey });
    assert.equal(expiredRes.isValid, false);
    assert.match(expiredRes.errorMessage || '', /expired/i);
  });

  it('pairs via WindowsHostBackendAdapter and executes real persistent PowerShell commands', async () => {
    const adapter = new WindowsHostBackendAdapter(baseUrl);
    const keyEnvelope = await adapter.connection.fetchActiveHostKey();

    const badConnect = await adapter.connection.connectToHost({ pairingKey: '000-000' });
    assert.equal(badConnect.success, false);

    const goodConnect = await adapter.connection.connectToHost({
      pairingKey: keyEnvelope.pairingKey,
    });
    assert.equal(goodConnect.success, true);
    assert.ok(goodConnect.sessionToken.startsWith('lt_sess_'));
    assert.equal(goodConnect.device.isOnline, true);

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

    const unauthorizedDirRes = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Write-Output "should-not-run"',
      workingDir: 'C:\\Windows\\System32',
    });
    assert.equal(unauthorizedDirRes.exitCode, 126);
    assert.match(unauthorizedDirRes.lines[0]?.content || '', /outside authorized workspace roots/i);

    const dangerousCmdRes = await adapter.terminal.executeCommand({
      sessionId: 'sess-pwsh',
      command: 'Stop-Computer -Force',
      workingDir: process.cwd(),
    });
    assert.equal(dangerousCmdRes.exitCode, 126);
    assert.match(dangerousCmdRes.lines[0]?.content || '', /SECURITY GUARD/);

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

    await adapter.connection.setHostServerStatus('restart');
    const key2 = (await adapter.connection.fetchActiveHostKey()).pairingKey;
    assert.notEqual(key2, key1);

    const oldKeyConnect = await adapter.connection.connectToHost({ pairingKey: key1 });
    assert.equal(oldKeyConnect.success, false);

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

  it('supports full persistent Windows PowerShell lifecycle: spaces, Unicode, standard commands, errors, multi-session isolation, and cleanup', async () => {
    const adapter = new WindowsHostBackendAdapter(baseUrl);
    const keyEnvelope = await adapter.connection.fetchActiveHostKey();
    await adapter.connection.connectToHost({ pairingKey: keyEnvelope.pairingKey });

    // Create two independent PowerShell sessions in tempTestRoot
    const sessA = await adapter.terminal.createSession({
      title: 'PWSH Isolation A',
      type: 'powershell',
      workingDir: tempTestRoot,
    });
    const sessB = await adapter.terminal.createSession({
      title: 'PWSH Isolation B',
      type: 'powershell',
      workingDir: tempTestRoot,
    });
    assert.notEqual(sessA.id, sessB.id);

    // 1. Standard PowerShell commands: whoami, pwd, Get-Location, mkdir with spaces, cd, New-Item Unicode, Get-Content, ls, dir, Get-ChildItem
    const whoamiRes = await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: 'whoami',
      workingDir: tempTestRoot,
    });
    assert.equal(whoamiRes.exitCode, 0);
    assert.ok(whoamiRes.lines.some((l) => l.content.includes('\\') || l.content.trim().length > 0));

    const mkRes = await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: 'mkdir "Sub Folder With Spaces" | Out-Null; cd "Sub Folder With Spaces"; pwd',
      workingDir: tempTestRoot,
    });
    assert.equal(mkRes.exitCode, 0);
    const expectedSubDir = path.join(tempTestRoot, 'Sub Folder With Spaces');
    assert.equal(mkRes.workingDir?.toLowerCase(), expectedSubDir.toLowerCase());
    assert.ok(fs.existsSync(expectedSubDir));

    const unicodeCmd =
      'New-Item -Path "üñîçødé notes.txt" -ItemType File -Force | Out-Null; Set-Content -LiteralPath "üñîçødé notes.txt" -Value "Hello Windows PowerShell 🚀" -NoNewline; Get-Content -LiteralPath "üñîçødé notes.txt"';
    const fileRes = await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: unicodeCmd,
      workingDir: expectedSubDir,
    });
    assert.equal(fileRes.exitCode, 0);
    assert.ok(
      fileRes.lines.map((l) => l.content).join('\n').includes('Hello Windows PowerShell 🚀'),
    );
    assert.equal(
      fs.readFileSync(path.join(expectedSubDir, 'üñîçødé notes.txt'), 'utf8').replace(/^\uFEFF/, ''),
      'Hello Windows PowerShell 🚀',
    );

    for (const listCmd of ['ls', 'dir', 'Get-ChildItem']) {
      const lsRes = await adapter.terminal.executeCommand({
        sessionId: sessA.id,
        command: listCmd,
        workingDir: expectedSubDir,
      });
      assert.equal(lsRes.exitCode, 0);
      assert.ok(
        lsRes.lines.map((l) => l.content).join('\n').includes('üñîçødé notes.txt'),
        `${listCmd} should list created Unicode file`,
      );
    }

    // 2. Session A sets variable; verify Session B is completely isolated (different cwd & no variable bleed)
    await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: '$isolatedSecret = "SESSION_A_ONLY"',
      workingDir: expectedSubDir,
    });

    const checkB = await adapter.terminal.executeCommand({
      sessionId: sessB.id,
      command: 'Write-Output "VAR=$($isolatedSecret)|CWD=$((Get-Location).Path)"',
      workingDir: tempTestRoot,
    });
    assert.equal(checkB.exitCode, 0);
    const outB = checkB.lines.map((l) => l.content).join('\n');
    assert.ok(outB.includes('VAR=|'), `Session B must not see Session A variable, got: ${outB}`);
    assert.ok(outB.toLowerCase().includes(tempTestRoot.toLowerCase()));
    assert.ok(!outB.toLowerCase().includes('sub folder with spaces'));

    // 3. Non-zero exit codes & syntax errors recover cleanly without breaking persistent state
    const exitCodeRes = await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: 'cmd /c "exit 9"',
      workingDir: expectedSubDir,
    });
    assert.equal(exitCodeRes.exitCode, 9);

    const syntaxErrRes = await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: 'if (',
      workingDir: expectedSubDir,
    });
    assert.notEqual(syntaxErrRes.exitCode, 0);
    assert.ok(syntaxErrRes.lines.some((l) => l.type === 'error'));

    // Verify Session A still remembers $isolatedSecret and its workingDir after errors + cd ..
    const recoverRes = await adapter.terminal.executeCommand({
      sessionId: sessA.id,
      command: 'cd ..; echo "$isolatedSecret|$((Get-Location).Path)"',
      workingDir: expectedSubDir,
    });
    assert.equal(recoverRes.exitCode, 0);
    const recoverText = recoverRes.lines.map((l) => l.content).join('\n');
    assert.ok(recoverText.includes('SESSION_A_ONLY'));
    assert.equal(recoverRes.workingDir?.toLowerCase(), tempTestRoot.toLowerCase());

    // 4. Close both sessions and verify cleanup
    await adapter.terminal.closeSession(sessA.id);
    await adapter.terminal.closeSession(sessB.id);
    const remaining = await adapter.terminal.listSessions();
    assert.ok(!remaining.some((s) => s.id === sessA.id || s.id === sessB.id));
  });
});
