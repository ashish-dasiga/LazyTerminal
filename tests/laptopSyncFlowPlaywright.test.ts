import { chromium } from '@playwright/test';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import assert from 'assert';
import { createHostCompanion } from '../src/host/router';
import { fsRouter } from '../src/server/fsRoutes';
import { gitRouter } from '../src/server/gitRoutes';

async function verifyLaptopSyncFlow() {
  console.log('========================================================================');
  console.log('--- Playwright Verification: Windows Companion Token-Only & Sync Flow ---');
  console.log('========================================================================');

  // 1. Setup local test server hosting dist build and API endpoints
  const app = express();
  const hostCompanion = createHostCompanion(undefined, { silentLogger: true });
  app.use(express.json());
  app.use('/api/v1/fs', fsRouter);
  app.use('/api/v1/git', gitRouter);
  app.use('/api/v1', hostCompanion.router);

  const distPath = path.join(process.cwd(), 'dist');
  assert.ok(fs.existsSync(distPath), 'dist/ directory must exist');
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const initialHostKey = hostCompanion.pairing.getCurrentKeyEnvelope().pairingKey;
  console.log(`✓ Test server running on ${baseUrl} (Host Pairing Key: ${initialHostKey})`);

  // Launch Chromium
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Open Windows Laptop App (Unconnected)
    // Must show randomly generated token ONLY with frontend theme
    // -------------------------------------------------------------------------
    console.log('\n[Phase 1] Verifying Initial Windows Companion State (Token Only)...');
    await page.goto(`${baseUrl}/?view=laptop`, { waitUntil: 'networkidle' });

    // Verify Title & Window Frame
    await page.waitForSelector('text=Relay Desktop Host — Windows', { timeout: 5000 });
    console.log('✓ Desktop Window Frame loaded.');

    // Verify Token Window is present
    await page.waitForSelector('text=Token Window', { timeout: 3000 });
    await page.waitForSelector('text=Random Token Number', { timeout: 3000 });

    const tokenDisplay = page.locator('.text-2xl.font-mono.font-bold').first();
    await tokenDisplay.waitFor({ state: 'visible', timeout: 3000 });
    const displayedToken = (await tokenDisplay.textContent())?.trim();
    console.log(`✓ Random Token displayed: ${displayedToken}`);
    assert.ok(displayedToken && displayedToken.length >= 6, 'Token must be at least 6 digits');

    // Verify Waiting Status indicator is present
    const waitingNotice = page.locator('text=Waiting for Android client to connect');
    assert.ok(await waitingNotice.isVisible(), 'Must display waiting status indicator before pairing');
    console.log('✓ "Waiting for Android client..." notice is visible.');

    // Verify that Sync Manager and Server Control are NOT shown yet (token ONLY)
    const syncManagerHeader = page.locator('span:has-text("Sync Manager")');
    const isSyncVisibleBefore = await syncManagerHeader.isVisible().catch(() => false);
    assert.strictEqual(isSyncVisibleBefore, false, 'Sync Manager must NOT be shown before connection');
    console.log('✓ Verified: Sync Manager is hidden while waiting for connection.');

    const serverControlHeader = page.locator('span:has-text("Server Control")');
    const isServerCtrlVisibleBefore = await serverControlHeader.isVisible().catch(() => false);
    assert.strictEqual(isServerCtrlVisibleBefore, false, 'Server Control must NOT be shown before connection');
    console.log('✓ Verified: Server Control is hidden while waiting for connection.');

    const artifactDir = 'C:\\Users\\Ashish Dasiga\\.gemini\\antigravity-cli\\brain\\5f0eae23-ad0e-454f-a36d-2c69c3828f0f';
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    // Capture screenshot of Unconnected Token-Only View
    const tokenOnlyShot = path.join(artifactDir, 'windows_companion_token_only.png');
    await page.screenshot({ path: tokenOnlyShot });
    console.log(`✓ Saved screenshot of Token-Only Standby: ${tokenOnlyShot}`);

    // Verify Copy Token action
    const copyBtn = page.locator('button:has-text("Copy Token")').first();
    await copyBtn.click();
    await page.waitForTimeout(300);
    const copiedFeedback = page.locator('text=Copied').first();
    assert.ok(await copiedFeedback.isVisible(), 'Copy token feedback must show "Copied"');
    console.log('✓ Copy Token button functional.');

    // Verify Regenerate Token action
    const regenBtn = page.locator('button[title*="Generate new random token"]').first();
    await regenBtn.click();
    await page.waitForTimeout(400);
    const regeneratedToken = (await tokenDisplay.textContent())?.trim();
    console.log(`✓ Regenerated Token: ${regeneratedToken}`);
    assert.notStrictEqual(regeneratedToken, displayedToken, 'Token should update upon regeneration');

    // -------------------------------------------------------------------------
    // Phase 2: Mobile Connection / Pairing
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Connecting Mobile Client with Token...');
    const connectBtn = page.locator('button:has-text("Simulate Mobile Connect")').first();
    assert.ok(await connectBtn.isVisible(), 'Simulate Mobile Connect button must be available for testing');
    await connectBtn.click();
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------------
    // Phase 3: Connected State Verification (Sync Manager & Everything Revealed)
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Verifying Connected State (Sync Manager & Everything Shown)...');

    // Connected Banner
    const connectedBanner = page.locator('text=Device Connected:');
    await connectedBanner.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Connected Device Banner is active.');

    // Now Sync Manager MUST be visible
    await page.waitForSelector('text=Sync Manager', { timeout: 3000 });
    console.log('✓ Sync Manager is now visible!');

    // Server Control MUST be visible
    await page.waitForSelector('text=Server Control', { timeout: 3000 });
    await page.waitForSelector('text=RUNNING', { timeout: 3000 });
    console.log('✓ Server Control is now visible with RUNNING status!');

    // Verify Sync Request execution
    const syncRequestBtn = page.locator('button:has-text("Sync Request")').first();
    await syncRequestBtn.click();
    console.log('Clicked "Sync Request" button...');

    // Wait for sync completion toast
    await page.waitForSelector('text=completed!', { timeout: 5000 });
    console.log('✓ Sync request completed successfully and toast displayed!');

    // Verify previous syncs dropdown is populated
    const syncDropdown = page.locator('select').first();
    const syncOptions = await syncDropdown.locator('option').allTextContents();
    console.log(`✓ Recorded Syncs in dropdown: ${syncOptions.length} entries (latest: ${syncOptions[0]})`);
    assert.ok(syncOptions.length >= 4, 'Must have recorded sync requests');

    // Capture screenshot of Connected View with Sync Manager and Server Control
    const connectedShot = path.join(artifactDir, 'windows_companion_connected_sync.png');
    await page.screenshot({ path: connectedShot });
    console.log(`✓ Saved screenshot of Connected Sync Manager: ${connectedShot}`);

    // Verify Disconnect returns to clean token-only view
    console.log('\n[Phase 4] Testing Disconnect to Return to Token-Only Standby...');
    const disconnectBtn = page.locator('button:has-text("Disconnect")').first();
    await disconnectBtn.click();
    await page.waitForTimeout(500);

    // Verify Sync Manager is hidden again
    const isSyncVisibleAfter = await syncManagerHeader.isVisible().catch(() => false);
    assert.strictEqual(isSyncVisibleAfter, false, 'Sync Manager must be hidden after disconnection');
    console.log('✓ Successfully returned to clean Token-Only standby view!');

    console.log('\n========================================================================');
    console.log('  ALL PLAYWRIGHT WINDOWS COMPANION & SYNC TESTS PASSED (100%)!          ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

verifyLaptopSyncFlow().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
