import { chromium } from '@playwright/test';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import assert from 'assert';
import { createHostCompanion } from '../src/host/router';
import { fsRouter } from '../src/server/fsRoutes';
import { gitRouter } from '../src/server/gitRoutes';

async function runPlaywrightVerification() {
  console.log('--- Starting Playwright End-to-End Browser Verification ---');

  // 1. Setup local test server hosting dist build and API endpoints
  const app = express();
  const hostCompanion = createHostCompanion(undefined, { silentLogger: true });
  app.use(express.json());
  app.use('/api/v1/fs', fsRouter);
  app.use('/api/v1/git', gitRouter);
  app.use('/api/v1', hostCompanion.router);

  const distPath = path.join(process.cwd(), 'dist');
  assert.ok(fs.existsSync(distPath), 'dist/ directory must exist (run npm run build first)');
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const livePairingKey = hostCompanion.pairing.getCurrentKeyEnvelope().pairingKey;
  console.log(`✓ Test server running on ${baseUrl} (Pairing Key: ${livePairingKey})`);

  const screenshotDir = process.env.LAZY_TERMINAL_SCREENSHOT_DIR;
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // 2. Launch Playwright headless browser
  console.log('Launching headless Chromium via Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 }, // Mobile viewport for Lazy Terminal
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));

  try {
    // 3. Navigate to app
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    console.log('✓ Successfully loaded Lazy Terminal web client.');

    // 3b. Handle switching to Mobile App if currently on portal
    const mobileSwitchBtn = page.locator('button:has-text("Mobile App (Android)")').first();
    if (await mobileSwitchBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      // Check if portal is active
      const portalTab = page.locator('button:has-text("Install Apps")').first();
      const isPortalActive = await portalTab.evaluate((el: HTMLElement) => el.classList.contains('text-white')).catch(() => false);
      if (isPortalActive) {
        console.log('✓ Verified Lazy Terminal Installation Portal.');
        await mobileSwitchBtn.click();
        await page.waitForTimeout(400);
        console.log('✓ Switched to Mobile App view.');
      }
    }

    // 4. Dismiss reconciliation modal if open
    const modalCloseBtn = page.locator('button:has-text("Skip All"), button:has-text("Execute All"), .fixed.inset-0.z-50 button').first();
    if (await modalCloseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Dismissing reconciliation modal overlay...');
      await modalCloseBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Handle initial connection flow if not connected
    const tokenInput = page.locator('input[placeholder*="784-291"], input[type="text"]').first();
    if (await tokenInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`Entering live connection key (${livePairingKey}) into mobile connection flow...`);
      await tokenInput.fill(livePairingKey);
      await page.waitForTimeout(300);

      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      console.log('Connecting to host session...');
      await page.waitForTimeout(1000);
    }

    // If another reconciliation modal opens after connection
    const postConnectModal = page.locator('.fixed.inset-0.z-50 button').first();
    if (await postConnectModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await postConnectModal.click();
      await page.waitForTimeout(300);
    }

    // 6. Navigate to Explorer screen
    console.log('Navigating to Explorer screen...');
    const explorerTab = page.locator('nav button:has-text("Explorer")').first();
    await explorerTab.click();
    await page.waitForTimeout(600);

    // Verify real workspace files (package.json, server.ts) are rendered from host /api/v1/fs/list
    const pkgItem = page.locator('text=package.json').first();
    await pkgItem.waitFor({ state: 'visible', timeout: 5000 });
    const serverTsItem = page.locator('text=server.ts').first();
    assert.ok(await serverTsItem.isVisible(), 'Explorer must display real workspace file server.ts');
    console.log('✓ Explorer rendered real host workspace files (package.json, server.ts).');

    if (screenshotDir) {
      await page.screenshot({ path: path.join(screenshotDir, '01-explorer-list.png') });
    }

    // 7. Test opening package.json in the mobile code editor and verifying real content from /api/v1/fs/read
    console.log('Opening package.json in code editor...');
    await pkgItem.click();
    await page.waitForTimeout(600);

    const editorToolbar = page.locator('button:has-text("Edit"), button:has-text("Save")').first();
    await editorToolbar.waitFor({ state: 'visible', timeout: 3000 });
    const codeViewerContent = await page.locator('pre').first().textContent();
    assert.ok(
      codeViewerContent && codeViewerContent.includes('"react-example"'),
      'Code viewer must display real package.json content fetched from host'
    );
    console.log('✓ Code viewer loaded real package.json content from host.');

    if (screenshotDir) {
      await page.screenshot({ path: path.join(screenshotDir, '02-explorer-editor.png') });
    }

    // Return to file list and test real subdirectory navigation (src/)
    const backBtn = page.locator('button[title*="return to folder"], button[title*="Close file"]').first();
    await backBtn.click();
    await page.waitForTimeout(400);

    const srcFolder = page.locator('span:text-is("src")').first();
    await srcFolder.click();
    await page.waitForTimeout(600);
    const appTsxItem = page.locator('text=App.tsx').first();
    await appTsxItem.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Subdirectory navigation into src/ loaded real files (App.tsx).');

    // 8. Navigate to Source Control screen
    console.log('Navigating to Source Control screen...');
    const gitTab = page.locator('nav button:has-text("Git")').first();
    await gitTab.click();
    await page.waitForTimeout(800);

    // Verify Source Control Header & Sync Status
    const sourceControlHeader = page.locator('text=Source Control').first();
    await sourceControlHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Source Control screen active.');

    // Verify Commit Changes input
    const commitInput = page.locator('input[placeholder*="Commit message"]');
    assert.ok(await commitInput.isVisible(), 'Commit message input must be visible');
    console.log('✓ Commit box verified in Source Control.');

    // Verify Branch selector displays the REAL active git branch
    const branchBtn = page.locator('button:has-text("main"), button:has-text("ashritha")').first();
    await branchBtn.waitFor({ state: 'visible', timeout: 5000 });
    const branchText = await branchBtn.textContent();
    console.log(`✓ Git branch selector verified showing real host branch: ${branchText?.trim()}.`);

    if (screenshotDir) {
      await page.screenshot({ path: path.join(screenshotDir, '03-source-control.png') });
    }

    console.log('\n======================================================');
    console.log('  PLAYWRIGHT END-TO-END VERIFICATION PASSED (100%)!   ');
    console.log('======================================================\n');
  } finally {
    hostCompanion.shutdown();
    await browser.close();
    server.close();
  }
}

runPlaywrightVerification().catch((err) => {
  console.error('\n❌ Playwright E2E Verification Failed:', err);
  process.exit(1);
});
