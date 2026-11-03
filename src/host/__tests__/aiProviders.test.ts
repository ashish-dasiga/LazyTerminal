import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resolveWindowsExecutableSpawn,
  inspectProviderAuth,
  tokenizeCliInput,
} from '../aiProviders';
import { findExecutableOnPath } from '../terminalManager';
import { startHostCompanionServer, RunningHostServer } from '../companionServer';
import { getBackendAdapter, setHostUrl } from '../../services';

describe('Real AI CLI Providers — Windows Spawn, Auth Probe, and Live Sessions', () => {
  let hostServer: RunningHostServer;
  let baseUrl: string;
  let tempWorkspace: string;

  before(async () => {
    const rawTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-ai-cli-test-'));
    tempWorkspace = fs.realpathSync.native
      ? fs.realpathSync.native(rawTmp)
      : fs.realpathSync(rawTmp);
    fs.writeFileSync(
      path.join(tempWorkspace, 'README.md'),
      '# Disposable AI CLI Test Workspace\nALPHA_TOKEN=42\n',
      'utf8',
    );

    hostServer = await startHostCompanionServer(
      {
        hostPort: 0,
        hostBind: '127.0.0.1',
        defaultWorkspaceRoot: tempWorkspace,
        allowedRoots: [tempWorkspace, process.cwd()],
        commandTimeoutMs: 60_000,
      },
      { silentLogger: true },
    );
    baseUrl = `http://127.0.0.1:${hostServer.port}`;
  });

  after(async () => {
    if (hostServer) {
      await hostServer.close();
    }
    if (tempWorkspace && fs.existsSync(tempWorkspace)) {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
  });

  it('resolves npm .cmd wrappers directly to node.exe + scriptPath without cmd.exe shell interpolation', () => {
    const geminiBin = findExecutableOnPath(['gemini.cmd', 'gemini.exe', 'gemini']);
    if (geminiBin && geminiBin.toLowerCase().endsWith('.cmd')) {
      const spec = resolveWindowsExecutableSpawn(geminiBin, ['-p', 'hello & world | "quoted"']);
      assert.equal(spec.resolvedViaNodeShim, true);
      assert.ok(spec.scriptPath && fs.existsSync(spec.scriptPath));
      assert.equal(spec.args[0], spec.scriptPath);
      assert.equal(spec.args[2], 'hello & world | "quoted"');
    }

    const claudeBin = findExecutableOnPath(['claude.exe', 'claude.cmd', 'claude']);
    if (claudeBin && claudeBin.toLowerCase().endsWith('.exe')) {
      const spec = resolveWindowsExecutableSpawn(claudeBin, ['--version']);
      assert.equal(spec.resolvedViaNodeShim, false);
      assert.equal(spec.command, claudeBin);
    }

    const tokens = tokenizeCliInput('gemini -m gemini-3.5-flash-lite -p "Reply with PONG"');
    assert.deepEqual(tokens, ['gemini', '-m', 'gemini-3.5-flash-lite', '-p', 'Reply with PONG']);
  });

  it('inspects real provider catalog and auth metadata over authenticated /api/v1/cli/tools', async () => {
    setHostUrl(baseUrl);
    const adapter = getBackendAdapter();
    const key = (await adapter.connection.fetchActiveHostKey!()).pairingKey;
    const conn = await adapter.connection.connectToHost({ pairingKey: key });
    assert.equal(conn.success, true);

    const tools = await adapter.cli.listTools();
    assert.equal(tools.length, 4);

    for (const id of ['claude', 'gemini', 'codex', 'antigravity']) {
      const item = tools.find((t) => t.id === id);
      assert.ok(item, `Expected ${id} in catalog`);
      if (item.executablePath) {
        assert.ok(fs.existsSync(item.executablePath), `Executable ${item.executablePath} must exist on disk`);
      }
      const auth = inspectProviderAuth(id, item.executablePath);
      assert.ok(['authenticated', 'unauthenticated', 'unknown', 'not_installed'].includes(auth.authStatus));
    }
  });

  it('executes real Claude Code and Gemini CLI sessions in disposable Windows workspace with honest output', async () => {
    setHostUrl(baseUrl);
    const adapter = getBackendAdapter();
    const key = (await adapter.connection.fetchActiveHostKey!()).pairingKey;
    await adapter.connection.connectToHost({ pairingKey: key });

    const claudeBin = findExecutableOnPath(['claude.exe', 'claude.cmd', 'claude']);
    if (claudeBin) {
      const claudeSession = await adapter.terminal.createSession({
        title: 'Claude Code',
        type: 'claude',
        workingDir: tempWorkspace,
      });
      assert.equal(claudeSession.type, 'claude');
      assert.equal(claudeSession.workingDir.toLowerCase(), tempWorkspace.toLowerCase());
      assert.ok(
        claudeSession.buffer.some((l) => l.content.includes('Claude Code')),
        'Initial session buffer should report real Claude Code binding',
      );

      // Run harmless prompt; whether user API quota succeeds or returns real 401/403 API error,
      // output must come from real claude.exe and never contain mock text.
      const claudeTurn = await adapter.terminal.executeCommand({
        sessionId: claudeSession.id,
        command: 'Reply with the single word PONG and nothing else.',
        workingDir: tempWorkspace,
      });
      const claudeOutput = claudeTurn.lines.map((l) => l.content).join('\n');
      assert.ok(claudeOutput.length > 0, 'Claude session must produce real CLI output or real API error');
      assert.ok(!claudeOutput.includes('hyper-relay'), 'Must never contain mock output');
      await adapter.terminal.closeSession(claudeSession.id);
    }

    const geminiBin = findExecutableOnPath(['gemini.cmd', 'gemini.exe', 'gemini']);
    if (geminiBin) {
      const geminiSession = await adapter.terminal.createSession({
        title: 'Gemini CLI',
        type: 'gemini',
        workingDir: tempWorkspace,
      });
      assert.equal(geminiSession.type, 'gemini');
      assert.equal(geminiSession.workingDir.toLowerCase(), tempWorkspace.toLowerCase());

      const geminiTurn = await adapter.terminal.executeCommand({
        sessionId: geminiSession.id,
        command: 'Reply with the single word PONG and nothing else.',
        workingDir: tempWorkspace,
        envOverrides: { GEMINI_MODEL: 'gemini-3.5-flash-lite' },
      });
      const geminiOutput = geminiTurn.lines.map((l) => l.content).join('\n');
      assert.ok(geminiOutput.length > 0, 'Gemini session must produce real CLI output');
      if (geminiTurn.exitCode === 0) {
        assert.match(geminiOutput, /PONG/i);
      }
      await adapter.terminal.closeSession(geminiSession.id);
    }
  });
});
