import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_CLI_DEFINITIONS,
  findExecutableOnPath,
  inspectCliStatus,
  getLiveCliCatalog,
  executeInstallTool,
} from '../src/services/cliDetector';

describe('CLI Detector Subsystem', () => {
  test('has definitions for Claude Code, Codex, Gemini, and Antigravity', () => {
    const ids = SUPPORTED_CLI_DEFINITIONS.map((d) => d.id);
    assert.ok(ids.includes('claude'), 'Claude Code definition must exist');
    assert.ok(ids.includes('codex'), 'Codex definition must exist');
    assert.ok(ids.includes('gemini'), 'Gemini definition must exist');
    assert.ok(ids.includes('antigravity'), 'Antigravity definition must exist');
  });

  test('reports isInstalled: false for non-existent executable', async () => {
    const status = await inspectCliStatus('non_existent_cli_tool_xyz_123');
    assert.equal(status.isInstalled, false);
    assert.equal(status.cliName, 'non_existent_cli_tool_xyz_123');
    assert.equal(status.path, undefined);
  });

  test('accurately detects verified tools on host without crashing', async () => {
    const catalog = await getLiveCliCatalog();
    assert.equal(catalog.length, 4);

    const claude = catalog.find((c) => c.id === 'claude');
    assert.ok(claude, 'Claude tool must be present');
    assert.ok(claude.capabilities.length > 0, 'Capabilities must be populated');
    assert.ok(claude.permissionsRequired.length > 0, 'Permissions must be listed');

    // On this host, claude is installed at ~/.local/bin/claude.exe
    const claudeStatus = await inspectCliStatus('claude');
    if (claudeStatus.isInstalled) {
      assert.ok(claudeStatus.path?.includes('claude'));
      assert.ok(claudeStatus.version);
    }
  });

  test('antigravity CLI tool is mapped to agy executable candidate', async () => {
    const agyStatus = await inspectCliStatus('antigravity');
    assert.ok(agyStatus);
    if (agyStatus.isInstalled) {
      assert.ok(agyStatus.path?.toLowerCase().includes('agy'));
    }
  });

  test('installTool handles unrecognized tools safely', async () => {
    const res = await executeInstallTool('fake_tool');
    assert.equal(res.success, false);
    assert.ok(res.outputLog.includes('not recognized'));
  });
});
