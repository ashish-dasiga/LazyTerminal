import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startHostCompanionServer, RunningHostServer } from '../src/host/companionServer';

test.describe.serial('Lazy Terminal — Core Regression E2E Suite', () => {
  let hostServer: RunningHostServer;
  let baseUrl = '';
  let tempRoot = '';

  test.beforeAll(async () => {
    const canonicalTmp = fs.realpathSync.native(os.tmpdir());
    tempRoot = fs.mkdtempSync(path.join(canonicalTmp, 'lazy-term-reg-'));
    fs.writeFileSync(path.join(tempRoot, 'sample.txt'), 'Regression workspace file\n', 'utf8');

    hostServer = await startHostCompanionServer(
      {
        hostBind: '127.0.0.1',
        hostPort: 0,
        defaultWorkspaceRoot: tempRoot,
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

  async function pairAndConnect(page: Page) {
    await page.goto(`${baseUrl}/?view=mobile`);
    await expect(page.getByRole('heading', { name: 'Connect to Windows PC' })).toBeVisible();

    const liveKey = hostServer.companion.pairing.getCurrentKeyEnvelope().pairingKey;
    await page.getByLabel('Pairing Code').fill(liveKey);
    await page.getByRole('button', { name: 'Connect to PC' }).click();

    await expect(page.getByTestId('terminal-prompt-line')).toBeVisible({ timeout: 15_000 });
  }

  test('1. Full Pairing Flow: Enter live pairing key and connect to real Windows host workspace', async ({
    page,
  }) => {
    await pairAndConnect(page);
    await expect(page.getByText(os.hostname()).first()).toBeVisible();
    await expect(page.locator('nav button[title="Terminal"]')).toBeVisible();
  });

  test('2. Terminal Command Execution: Real PowerShell output streaming', async ({ page }) => {
    await pairAndConnect(page);

    const termInput = page.locator('input[placeholder*="Run command"]');
    await expect(termInput).toBeVisible();
    await termInput.fill('Get-ChildItem -Name');
    await termInput.press('Enter');

    await expect(page.getByText('sample.txt').last()).toBeVisible({ timeout: 15_000 });
  });

  test('3. Honest Offline Intent Buffering: Local persistence when PC is offline', async ({
    page,
  }) => {
    await pairAndConnect(page);

    await page.locator('nav button[title="More"]').click();
    await expect(page.getByText('More Options & Offline Engine')).toBeVisible();

    await page.getByRole('button', { name: /Go Offline/i }).click();
    await expect(page.getByRole('button', { name: /Reconnect PC/i })).toBeVisible();

    await page.locator('nav button[title="Terminal"]').click();
    const termInput = page.locator('input[placeholder*="Draft command"]');
    await expect(termInput).toBeVisible();

    await termInput.fill('Write-Output "QUEUED_OFFLINE_ONLY"');
    await termInput.press('Enter');

    await expect(page.getByText('Buffered locally (PC offline)').first()).toBeVisible();
  });

  test('4. Reconnection & Reconciliation: Explicit user review required', async ({ page }) => {
    await pairAndConnect(page);

    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /Go Offline/i }).click();

    await page.locator('nav button[title="Terminal"]').click();
    const termInput = page.locator('input[placeholder*="Draft command"]');
    await termInput.fill('Write-Output "RECONCILED_REAL_OK"');
    await termInput.press('Enter');
    await expect(page.getByText('Buffered locally (PC offline)').first()).toBeVisible();

    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /Reconnect PC/i }).click();

    await expect(
      page.getByRole('heading', { name: 'PC Reconnected: State Synchronization' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Execute Intents Now' }).click();
    await expect(
      page.getByRole('heading', { name: 'PC Reconnected: State Synchronization' })
    ).toHaveCount(0);
  });

  test('5. Persistent Bottom Navigation: Terminal, Explorer, Git, Preview, More', async ({
    page,
  }) => {
    await pairAndConnect(page);

    await page.locator('nav button[title="Explorer"]').click();
    await expect(page.getByTestId('explorer-item-sample.txt')).toBeVisible();

    await page.locator('nav button[title="Git"]').click();
    await expect(page.getByText('Not a Git Repository')).toBeVisible();

    await page.locator('nav button[title="Preview"]').click();
    await expect(page.getByText(/Preview/i).first()).toBeVisible();

    await page.locator('nav button[title="More"]').click();
    await expect(page.getByText('More Options & Offline Engine')).toBeVisible();

    await page.locator('nav button[title="Terminal"]').click();
    await expect(page.getByTestId('terminal-prompt-line')).toBeVisible();
  });

  test('6. Dual Frontend Architecture: Portal, Laptop Companion View, and Mobile View', async ({
    page,
  }) => {
    await page.goto(`${baseUrl}/`);
    await expect(page.getByText(/Lazy Terminal/i).first()).toBeVisible();

    await page.goto(`${baseUrl}/?view=laptop`);
    await expect(page.getByText('Relay Desktop Host — Windows')).toBeVisible();

    await page.goto(`${baseUrl}/?view=mobile`);
    await expect(page.getByRole('heading', { name: 'Connect to Windows PC' })).toBeVisible();
  });

  test('7. Offline Queue Persistence: Survives reload in IndexedDB without auto-executing', async ({
    page,
  }) => {
    await pairAndConnect(page);

    await page.locator('nav button[title="More"]').click();
    await page.getByRole('button', { name: /Go Offline/i }).click();

    await page.locator('nav button[title="Terminal"]').click();
    const termInput = page.locator('input[placeholder*="Draft command"]');
    await termInput.fill('Write-Output "PERSISTED_IN_IDB"');
    await termInput.press('Enter');
    await expect(page.getByText('Buffered locally (PC offline)').first()).toBeVisible();

    // Clear sessionStorage to simulate cold tab reopen while keeping IndexedDB intact
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Connect to Windows PC' })).toBeVisible();

    const liveKey = hostServer.companion.pairing.getCurrentKeyEnvelope().pairingKey;
    await page.getByLabel('Pairing Code').fill(liveKey);
    await page.getByRole('button', { name: 'Connect to PC' }).click();

    await expect(
      page.getByRole('heading', { name: 'PC Reconnected: State Synchronization' })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Write-Output "PERSISTED_IN_IDB"')).toBeVisible();
  });
});
