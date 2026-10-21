import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import {
  SUPPORTED_CLI_DEFINITIONS,
  inspectCliStatus,
  getLiveCliCatalog,
  executeInstallTool,
  getCapabilityMatrix,
  launchCliAgent,
  redactSecrets,
  sanitizeLaunchEnv,
} from '../src/services/cliDetector';

describe('CLI Detector & Agent Launch Subsystem (S1-S3)', () => {
  test('S1: capability matrix lists verified, unverified, and unsupported capabilities honestly', () => {
    const matrix = getCapabilityMatrix();
    assert.equal(matrix.length, 4);

    const claude = matrix.find((m) => m.id === 'claude');
    assert.equal(claude?.windowsSupport, 'verified');
    assert.equal(claude?.interactivePtySession, 'verified');

    const agy = matrix.find((m) => m.id === 'antigravity');
    assert.equal(agy?.autonomousDaemonBridge, 'unsupported');
    assert.equal(agy?.interactivePtySession, 'unverified');
  });

  test('S2: has definitions for Claude Code, Codex, Gemini, and Antigravity', () => {
    const ids = SUPPORTED_CLI_DEFINITIONS.map((d) => d.id);
    assert.ok(ids.includes('claude'), 'Claude Code definition must exist');
    assert.ok(ids.includes('codex'), 'Codex definition must exist');
    assert.ok(ids.includes('gemini'), 'Gemini definition must exist');
    assert.ok(ids.includes('antigravity'), 'Antigravity definition must exist');
  });

  test('S2: reports isInstalled: false for non-existent executable', async () => {
    const status = await inspectCliStatus('non_existent_cli_tool_xyz_123');
    assert.equal(status.isInstalled, false);
    assert.equal(status.cliName, 'non_existent_cli_tool_xyz_123');
    assert.equal(status.path, undefined);
  });

  test('S2: accurately detects verified tools and extracts versions including .cmd wrappers', async () => {
    const catalog = await getLiveCliCatalog();
    assert.equal(catalog.length, 4);

    const claude = catalog.find((c) => c.id === 'claude');
    assert.ok(claude, 'Claude tool must be present');
    assert.ok(claude.capabilities.length > 0, 'Capabilities must be populated');
    assert.ok(claude.permissionsRequired.length > 0, 'Permissions must be listed');

    const claudeStatus = await inspectCliStatus('claude');
    if (claudeStatus.isInstalled) {
      assert.ok(claudeStatus.path?.toLowerCase().includes('claude'));
      assert.ok(claudeStatus.version && claudeStatus.version !== 'Installed (version unknown)');
    }
  });

  test('S2: antigravity CLI tool is mapped to agy executable candidate', async () => {
    const agyStatus = await inspectCliStatus('antigravity');
    assert.ok(agyStatus);
    if (agyStatus.isInstalled) {
      assert.ok(agyStatus.path?.toLowerCase().includes('agy'));
    }
  });

  test('S3: launchCliAgent launches a verified agent in the selected working directory', async () => {
    const claudeStatus = await inspectCliStatus('claude');
    if (claudeStatus.isInstalled) {
      const res = await launchCliAgent({
        toolId: 'claude',
        workingDir: process.cwd(),
        args: ['--version'],
      });
      assert.equal(res.launched, true);
      assert.equal(res.status, 'completed');
      assert.equal(res.exitCode, 0);
      assert.ok(res.output.length > 0);
    }
  });

  test('S3: launchCliAgent rejects invalid working directory and unsupported headless antigravity launch', async () => {
    const badDirRes = await launchCliAgent({
      toolId: 'claude',
      workingDir: path.join(process.cwd(), 'non_existent_dir_999'),
    });
    assert.equal(badDirRes.launched, false);
    assert.equal(badDirRes.status, 'error');
    assert.ok(badDirRes.output.includes('Invalid working directory'));

    const agyRes = await launchCliAgent({
      toolId: 'antigravity',
      workingDir: process.cwd(),
    });
    assert.equal(agyRes.launched, false);
    assert.ok(agyRes.status === 'unsupported' || agyRes.status === 'not_installed');
  });

  test('S3: redactSecrets and sanitizeLaunchEnv prevent credential leakage', () => {
    const envCheck = sanitizeLaunchEnv({
      ANTHROPIC_API_KEY: 'sk-ant-secret1234567890',
      OPENAI_API_KEY: 'sk-proj-secret1234567890',
      NODE_ENV: 'development',
    });
    assert.ok(envCheck.redactedKeys.includes('ANTHROPIC_API_KEY'));
    assert.ok(envCheck.redactedKeys.includes('OPENAI_API_KEY'));
    assert.ok(!envCheck.redactedKeys.includes('NODE_ENV'));

    const scrubbed = redactSecrets('Using token sk-ant-api03-1234567890abcdef and OPENAI_API_KEY=mysecretval');
    assert.ok(!scrubbed.includes('sk-ant-api03-1234567890abcdef'));
    assert.ok(!scrubbed.includes('mysecretval'));
    assert.ok(scrubbed.includes('[REDACTED_SECRET]'));
  });

  test('S3: installTool handles unrecognized tools safely', async () => {
    const res = await executeInstallTool('fake_tool');
    assert.equal(res.success, false);
    assert.ok(res.outputLog.includes('not recognized'));
  });
});
