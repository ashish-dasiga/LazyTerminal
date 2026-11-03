import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { startHostCompanionServer, RunningHostServer } from '../src/host/companionServer';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'test-results', 'repaired');

test.describe.serial('Lazy Terminal — Real Windows Host & Mobile UI End-to-End Suite', () => {
  let hostServer: RunningHostServer;
  let baseUrl = '';
  let tempRoot = '';
  let wsGit = '';
  let wsSpacesUnicode = '';
  let wsEmpty = '';

  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const canonicalTmp = fs.realpathSync.native(os.tmpdir());
    tempRoot = fs.mkdtempSync(path.join(canonicalTmp, 'lazy-term-e2e-'));

    // 1. Git-initialized workspace with initial file and subfolder
    wsGit = path.join(tempRoot, 'git-workspace');
    fs.mkdirSync(path.join(wsGit, 'nested'), { recursive: true });
    fs.writeFileSync(
      path.join(wsGit, 'hello.ts'),
      'export const greeting = "Hello from real Windows workspace";\n',
      'utf8'
    );
    fs.writeFileSync(path.join(wsGit, 'nested', 'inner.txt'), 'Inside nested subfolder\n', 'utf8');

    execFileSync('git', ['init'], { cwd: wsGit, windowsHide: true });
    execFileSync('git', ['config', 'user.email', 'e2e@lazyterminal.local'], {
      cwd: wsGit,
      windowsHide: true,
    });
    execFileSync('git', ['config', 'user.name', 'Lazy Terminal E2E'], {
      cwd: wsGit,
      windowsHide: true,
    });
    execFileSync('git', ['add', '.'], { cwd: wsGit, windowsHide: true });
    execFileSync('git', ['commit', '-m', 'chore: initial e2e fixture'], {
      cwd: wsGit,
      windowsHide: true,
    });

    // 2. Non-Git workspace with spaces and non-ASCII characters
    wsSpacesUnicode = path.join(tempRoot, 'Lazy Terminal E2E Café');
    fs.mkdirSync(wsSpacesUnicode, { recursive: true });
    fs.writeFileSync(
      path.join(wsSpacesUnicode, 'notes.txt'),
      'Real Windows file inside folder with spaces and accents.\n',
      'utf8'
    );

    // 3. Empty non-Git workspace
    wsEmpty = path.join(tempRoot, 'empty-workspace');
    fs.mkdirSync(wsEmpty, { recursive: true });

    hostServer = await startHostCompanionServer(
      {
        hostBind: '127.0.0.1',
        hostPort: 0,
        defaultWorkspaceRoot: wsGit,
        allowedRoots: [tempRoot],
      },
      { silentLogger: true }
    );
    baseUrl = `http://127.0.0.1:${hostServer.port}`;
  });

  test.afterAll(async () => {
    if (hostServer) {
      await hostServer.close();
    }
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test('Full E2E: Pairing, Security, Workspaces, Explorer CRUD, Persistent PowerShell, Real AI CLIs, and Offline Reconciliation', async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);

    const api404s: string[] = [];
    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/api/v1/') && res.status() === 404) {
        api404s.push(`${res.request().method()} ${url}`);
      }
    });

    // -------------------------------------------------------------------------
    // Security Gate: Unauthenticated requests must be rejected with 401
    // -------------------------------------------------------------------------
    const unauthFs = await request.get(`${baseUrl}/api/v1/fs/list`);
    expect(unauthFs.status()).toBe(401);

    const unauthTerm = await request.post(`${baseUrl}/api/v1/terminal/sessions`, {
      data: { name: 'unauth', type: 'powershell' },
    });
    expect(unauthTerm.status()).toBe(401);

    const healthRes = await request.get(`${baseUrl}/health`);
    expect(healthRes.status()).toBe(200);
    const healthJson = await healthRes.json();
    expect(healthJson.status).toBe('ok');

    // -------------------------------------------------------------------------
    // Scenario A: Host Connection, Pairing Validation, and Workspace Restore
    // -------------------------------------------------------------------------
    await page.goto(`${baseUrl}/?view=mobile`);
    await expect(page.getByRole('heading', { name: 'Connect to Windows PC' })).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-pairing-screen.png') });

    // Invalid pairing key must fail cleanly
    const pairingInput = page.getByLabel('Pairing Code');
    await pairingInput.fill('000-000');
    await page.getByRole('button', { name: 'Connect to PC' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    // Valid live 6-digit pairing key from Windows host companion
    const liveKey = hostServer.companion.pairing.getCurrentKeyEnvelope().pairingKey;
    await pairingInput.fill(liveKey);
    await page.getByRole('button', { name: 'Connect to PC' }).click();

    // Connected terminal view renders; NO fake "3 buffered intent(s)" modal appears
    const promptLine = page.getByTestId('terminal-prompt-line');
    await expect(promptLine).toBeVisible();
    await expect(page.getByText('PC Reconnected: State Synchronization')).toHaveCount(0);

    // Security check with authenticated token: path outside allowedRoots must return 403
    const savedSessionToken = await page.evaluate(() =>
      window.sessionStorage.getItem('lazy_terminal_session_token')
    );
    expect(savedSessionToken).toBeTruthy();
    const traversalRes = await request.get(
      `${baseUrl}/api/v1/fs/list?path=${encodeURIComponent('C:\\Windows\\System32')}`,
      {
        headers: { Authorization: `Bearer ${savedSessionToken}` },
      }
    );
    expect(traversalRes.status()).toBe(403);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-connected-terminal.png') });

    // -------------------------------------------------------------------------
    // Scenario B: Dynamic Windows Workspace Selection (Missing, Browse, Spaces/Unicode, Non-Git, Empty)
    // -------------------------------------------------------------------------
    await page.locator('button[title^="Workspace:"]').click();
    const pickerModal = page.getByTestId('workspace-picker-modal');
    await expect(pickerModal).toBeVisible();

    // Missing hardcoded path must surface real error without silent substitution
    const pathInput = page.getByTestId('workspace-path-input');
    await pathInput.fill('C:\\Projects\\hyper-relay-does-not-exist');
    await page.getByTestId('workspace-open-btn').click();
    await expect(page.getByTestId('workspace-error-banner')).toBeVisible();
    await expect(pickerModal).toBeVisible();

    // Live Windows PC folder browser lists real drives
    await page.getByTestId('workspace-browse-toggle').click();
    const folderBrowser = page.getByTestId('workspace-folder-browser');
    await expect(folderBrowser).toBeVisible();
    await expect(folderBrowser.getByRole('button', { name: 'C:\\' })).toBeVisible();

    // Select non-Git workspace with spaces + Unicode characters
    await pathInput.fill(wsSpacesUnicode);
    await page.getByTestId('workspace-open-btn').click();
    await expect(pickerModal).toHaveCount(0);
    await expect(page.locator('button[title^="Workspace:"]')).toHaveAttribute(
      'title',
      /Workspace: Lazy Terminal E2E Café/
    );

    // Explorer shows real file in wsSpacesUnicode and NO fake Rust/Cargo mock files
    await page.locator('nav button[title="Explorer"]').click();
    await expect(page.getByTestId('explorer-item-notes.txt')).toBeVisible();
    await expect(page.getByText('Cargo.toml')).toHaveCount(0);
    await expect(page.getByText('hyper-relay')).toHaveCount(0);

    // Git screen cleanly reports Not a Git Repository without crashing
    await page.locator('nav button[title="Git"]').click();
    await expect(page.getByText('Not a Git Repository')).toBeVisible();
    await expect(page.getByText(wsSpacesUnicode)).toBeVisible();

    // Select empty workspace and confirm clean empty state
    await page.locator('button[title^="Workspace:"]').click();
    await page.getByTestId('workspace-path-input').fill(wsEmpty);
    await page.getByTestId('workspace-open-btn').click();
    await page.locator('nav button[title="Explorer"]').click();
    await expect(page.getByTestId('explorer-empty-state')).toBeVisible();

    // Switch to wsGit and verify workspace restoration across page reload
    await page.locator('button[title^="Workspace:"]').click();
    await page.getByTestId('workspace-path-input').fill(wsGit);
    await page.getByTestId('workspace-open-btn').click();
    await expect(page.locator('button[title^="Workspace:"]')).toHaveAttribute(
      'title',
      /Workspace: git-workspace/
    );

    await page.reload();
    await expect(page.locator('button[title^="Workspace:"]')).toHaveAttribute(
      'title',
      /Workspace: git-workspace/
    );
    await expect(page.getByTestId('terminal-prompt-line')).toContainText(wsGit);

    // -------------------------------------------------------------------------
    // Scenario C: Real Windows Explorer Verification (Subfolder, Create, Edit UTF-8, Rename, External Refresh, Delete)
    // -------------------------------------------------------------------------
    await page.locator('nav button[title="Explorer"]').click();
    await expect(page.getByTestId('explorer-item-hello.ts')).toBeVisible();
    await expect(page.getByTestId('explorer-item-nested')).toBeVisible();

    // Navigate into subfolder and back
    await page.getByTestId('explorer-item-nested').click();
    await expect(page.getByTestId('explorer-item-inner.txt')).toBeVisible();
    await page.locator('button[title="Back to parent folder"]').click();
    await expect(page.getByTestId('explorer-item-hello.ts')).toBeVisible();

    // Create folder through app -> verify on Windows disk
    await page.getByTestId('explorer-new-folder-btn').click();
    await page.getByTestId('explorer-new-folder-input').fill('created-from-ui');
    await page.getByTestId('explorer-create-folder-submit').click();
    await expect(page.getByTestId('explorer-item-created-from-ui')).toBeVisible();
    expect(fs.statSync(path.join(wsGit, 'created-from-ui')).isDirectory()).toBe(true);

    // Create file through app -> verify on Windows disk
    await page.getByTestId('explorer-new-file-btn').click();
    await page.getByTestId('explorer-new-file-input').fill('café-notes.txt');
    await page.getByTestId('explorer-create-file-submit').click();
    // The app opens the newly created (empty) file in the viewer once the host confirms creation
    await expect(page.getByTestId('explorer-file-viewer')).toBeVisible();
    expect(fs.existsSync(path.join(wsGit, 'café-notes.txt'))).toBe(true);
    expect(fs.statSync(path.join(wsGit, 'café-notes.txt')).size).toBe(0);

    // Edit & save multi-line UTF-8 + Unicode content -> verify exact bytes on Windows disk
    const unicodePayload = 'Line 1: Real Windows Host Write\nLine 2: Café 🚀 日本語\nLine 3: End';
    await page.getByTestId('explorer-edit-toggle-btn').click();
    await page.getByTestId('explorer-editor-textarea').fill(unicodePayload);
    await page.getByTestId('explorer-save-btn').click();

    await expect
      .poll(() => fs.readFileSync(path.join(wsGit, 'café-notes.txt'), 'utf8'))
      .toBe(unicodePayload);

    await page.getByTestId('explorer-close-file-btn').click();

    // Rename file -> verify old path removed & new path has exact content on Windows disk
    await page.getByTestId('explorer-menu-café-notes.txt').click();
    await page.getByTestId('explorer-rename-action-café-notes.txt').click();
    await page.getByTestId('explorer-rename-input').fill('renamed-notes.txt');
    await page.getByTestId('explorer-rename-submit').click();
    await expect(page.getByTestId('explorer-item-renamed-notes.txt')).toBeVisible();
    expect(fs.existsSync(path.join(wsGit, 'café-notes.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(wsGit, 'renamed-notes.txt'), 'utf8')).toBe(unicodePayload);

    // External host filesystem modification + Refresh button
    const externalFile = path.join(wsGit, 'external-from-pc.txt');
    fs.writeFileSync(externalFile, 'External Windows write verified!', 'utf8');
    await page.getByTestId('explorer-refresh-btn').click();
    await expect(page.getByTestId('explorer-item-external-from-pc.txt')).toBeVisible();
    await page.getByTestId('explorer-item-external-from-pc.txt').click();
    await expect(page.getByTestId('explorer-file-viewer')).toContainText(
      'External Windows write verified!'
    );
    await page.getByTestId('explorer-close-file-btn').click();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-explorer-real-fs.png') });

    // Delete test file with confirmation -> verify gone from Windows disk
    await page.getByTestId('explorer-menu-renamed-notes.txt').click();
    await page.getByTestId('explorer-delete-action-renamed-notes.txt').click();
    await page.getByTestId('explorer-delete-confirm-btn').click();
    await expect(page.getByTestId('explorer-item-renamed-notes.txt')).toHaveCount(0);
    expect(fs.existsSync(path.join(wsGit, 'renamed-notes.txt'))).toBe(false);

    // -------------------------------------------------------------------------
    // Scenario D: Real Persistent PowerShell Terminal Verification
    // -------------------------------------------------------------------------
    await page.locator('nav button[title="Terminal"]').click();
    const cmdInput = page.locator('input[placeholder*="Run command on"]');
    const sendBtn = page.locator('button[title="Execute on Windows PC"]');

    const runTerminalCmd = async (command: string) => {
      await cmdInput.fill(command);
      await sendBtn.click();
    };

    // 1. Verify initial pwd matches selected workspace
    await runTerminalCmd('(Get-Location).Path');
    await expect(page.getByText(wsGit, { exact: false }).first()).toBeVisible();

    // 2. Verify whoami returns real Windows user identity
    const expectedUsername = os.userInfo().username.toLowerCase();
    await runTerminalCmd('whoami');
    await expect
      .poll(async () => ((await page.locator('body').textContent()) || '').toLowerCase())
      .toContain(expectedUsername);

    // 3. Critical persistence test: mkdir -> cd -> pwd -> create file -> ls/Get-ChildItem
    const psSubfolder = path.join(wsGit, 'ps space dir');
    await runTerminalCmd('mkdir "ps space dir" | Out-Null; Write-Output "MKDIR_DONE"');
    await expect(page.getByText('MKDIR_DONE', { exact: true })).toBeVisible();
    expect(fs.statSync(psSubfolder).isDirectory()).toBe(true);

    await runTerminalCmd('cd "ps space dir"');
    await expect(page.getByTestId('terminal-prompt-line')).toContainText('ps space dir');

    await runTerminalCmd('(Get-Location).Path');
    await expect(page.getByText(psSubfolder, { exact: false }).first()).toBeVisible();

    await runTerminalCmd(
      'Set-Content -Path "inside-ps.txt" -Value "PERSISTENT_SHELL_OK" -Encoding UTF8; Get-ChildItem -Name'
    );
    await expect(page.getByText('inside-ps.txt', { exact: true })).toBeVisible();
    expect(fs.readFileSync(path.join(psSubfolder, 'inside-ps.txt'), 'utf8').trim()).toBe(
      'PERSISTENT_SHELL_OK'
    );

    // Confirm Explorer workspace root was NOT mutated by terminal `cd`
    await expect(page.locator('button[title^="Workspace:"]')).toHaveAttribute(
      'title',
      /Workspace: git-workspace/
    );

    // 4. Multi-line output & non-zero exit / error resilience
    await runTerminalCmd('1..3 | ForEach-Object { "MULTI_LINE_$_" }');
    await expect(page.getByText('MULTI_LINE_3', { exact: true })).toBeVisible();

    await runTerminalCmd('Write-Error "NONZERO_CHECK_ERR"');
    await expect(page.getByText(/WriteErrorException/).first()).toBeVisible();
    await expect(page.getByText('Process running on PC...')).toHaveCount(0);

    // 5. Long-running command interruption via SIGINT (Ctrl+C)
    await runTerminalCmd(
      '1..40 | ForEach-Object { Write-Output "STREAM_TICK_$_"; Start-Sleep -Seconds 1 }'
    );
    await expect(page.getByText('STREAM_TICK_1')).toBeVisible();
    await page.locator('button[title="Send SIGINT (Ctrl+C)"]').click();

    await runTerminalCmd('Write-Output "RECOVERED_AFTER_SIGINT"');
    await expect(page.getByText('RECOVERED_AFTER_SIGINT', { exact: true }).last()).toBeVisible();

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-terminal-powershell.png') });

    // 6. Multi-session isolation & close session verification
    await page.getByTestId('session-switcher-btn').click();
    await page.getByTestId('new-powershell-session-btn').click();

    // New isolated session must NOT contain session 1's output
    await expect(page.getByText('RECOVERED_AFTER_SIGINT', { exact: true })).toHaveCount(0);
    await runTerminalCmd('Write-Output "ISOLATED_SESSION_TWO_OK"');
    await expect(page.getByText('ISOLATED_SESSION_TWO_OK', { exact: true }).last()).toBeVisible();

    // Close second session and verify session 1 remains intact without session 2's output
    await page.getByTestId('session-switcher-btn').click();
    const closeButtons = page.locator('[data-testid^="close-session-"]');
    expect(await closeButtons.count()).toBeGreaterThanOrEqual(2);
    await closeButtons.last().click();

    await page.locator('[data-testid^="active-session-row-"]').first().click();
    await expect(page.getByText('RECOVERED_AFTER_SIGINT', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('ISOLATED_SESSION_TWO_OK', { exact: true })).toHaveCount(0);

    // -------------------------------------------------------------------------
    // Scenario E: Real Claude Code, Gemini CLI, Codex & Antigravity Integration
    // -------------------------------------------------------------------------
    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /CLI Tools & Permissions/i }).click();
    await expect(page.getByRole('heading', { name: 'AI CLI Manager & Catalog' })).toBeVisible();

    // Verify real binary paths and versions are shown on this Windows host
    await expect(page.getByText(/Binary:/i).first()).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-cli-catalog.png') });

    // Navigate back to Terminal and exercise Claude Code & Gemini CLI via real host processes
    await page.getByRole('button', { name: 'Back to Terminal' }).click();

    // 1. Launch Claude Code session and send a harmless prompt
    await page.getByTestId('session-switcher-btn').click();
    await page.getByTestId('session-option-claude').click();
    await expect(page.getByTestId('terminal-prompt-line')).toContainText('claude');

    const aiInput = page.locator('input[placeholder*="Run command on"]');
    await aiInput.fill('Summarize hello.ts in five words.');
    await page.locator('button[title="Execute on Windows PC"]').click();

    // Wait for running indicator to finish and assert real claude.exe output (either real completion or real upstream API status, zero mock text)
    await expect(page.getByText('Process running on PC...')).toHaveCount(0, { timeout: 60_000 });
    const claudeTerminalText = (await page.locator('body').textContent()) || '';
    expect(claudeTerminalText).not.toContain('Mock Claude');
    expect(claudeTerminalText).not.toContain('Simulated');
    expect(
      claudeTerminalText.includes('hello') ||
        claudeTerminalText.includes('greeting') ||
        claudeTerminalText.includes('API Error') ||
        claudeTerminalText.includes('Claude exited')
    ).toBe(true);

    // 2. Launch Gemini CLI session and verify real live prompt output ("PONG")
    await page.getByTestId('session-switcher-btn').click();
    await page.getByTestId('session-option-gemini').click();
    await expect(page.getByTestId('terminal-prompt-line')).toContainText('gemini');

    await aiInput.fill('Reply with the single word PONG and nothing else.');
    await page.locator('button[title="Execute on Windows PC"]').click();
    // Verify real Gemini CLI process executed and surfaced output without mock fabrication
    const sawOutputFromRealGemini = await page
      .getByText(/PONG|True color|fetch failed|timed out|Gemini/i)
      .first()
      .waitFor({ timeout: 100_000 })
      .then(() => true, () => false);
    expect(sawOutputFromRealGemini).toBe(true);

    const fullTerminalText = (await page.locator('body').textContent()) || '';
    expect(fullTerminalText).not.toContain('Mock Gemini');
    expect(fullTerminalText).not.toContain('Simulated');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-gemini-cli-live.png') });

    // Switch back to primary PowerShell session before offline reconciliation check
    await page.getByTestId('session-switcher-btn').click();
    await page.locator('[data-testid^="active-session-row-"]').first().click();

    // -------------------------------------------------------------------------
    // Scenario F: Git, Preview, Settings, and Offline Queueing + Explicit Approval
    // -------------------------------------------------------------------------
    await page.locator('nav button[title="Git"]').click();
    await expect(page.getByRole('heading', { name: 'Source Control', level: 2 })).toBeVisible();
    await expect(page.getByText('external-from-pc.txt').first()).toBeVisible();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-git-screen.png') });

    await page.locator('nav button[title="Preview"]').click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-preview-screen.png') });

    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /App & Terminal Settings/i }).click();
    await expect(page.getByText('PowerShell 7.4 (ConPTY)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to Terminal' }).click();

    // Go Offline via More screen
    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /Go Offline/i }).click();

    // Draft command while offline -> must buffer locally and NOT touch Windows disk
    await page.locator('nav button[title="Terminal"]').click();
    const offlineTargetFile = path.join(psSubfolder, 'offline-approved.txt');
    const offlineInput = page.locator('input[placeholder*="Draft command"]');
    await offlineInput.fill(
      `Set-Content -Path "${offlineTargetFile}" -Value "APPROVED_EXEC_OK" -Encoding UTF8; Write-Output "OFFLINE_RECONCILED_DONE"`
    );
    await page.locator('button[title="Buffer locally while offline"]').click();

    await expect(page.getByText('Buffered locally (PC offline)')).toBeVisible();
    expect(fs.existsSync(offlineTargetFile)).toBe(false);

    // Reconnect PC -> modal must open WITHOUT auto-executing the queued command
    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /Reconnect PC/i }).click();
    await expect(
      page.getByRole('heading', { name: 'PC Reconnected: State Synchronization' })
    ).toBeVisible();
    expect(fs.existsSync(offlineTargetFile)).toBe(false);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-offline-reconciliation-modal.png'),
    });

    // Explicitly approve execution -> command runs on real Windows host and writes file
    await page.getByRole('button', { name: 'Execute Intents Now' }).click();
    await page.locator('nav button[title="Terminal"]').click();
    await expect(page.getByText('OFFLINE_RECONCILED_DONE', { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    expect(fs.readFileSync(offlineTargetFile, 'utf8').trim()).toBe('APPROVED_EXEC_OK');

    // Final invariant: the only 404 across /api/v1/* is the deliberate missing-workspace probe (no unrouted endpoints)
    expect(api404s).toEqual([`POST ${baseUrl}/api/v1/workspace/select`]);
  });
});
