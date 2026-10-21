import { chromium } from '@playwright/test';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import assert from 'assert';
import { fsRouter } from '../src/server/fsRoutes';
import { gitRouter } from '../src/server/gitRoutes';

async function runPlaywrightVerification() {
  console.log('--- Starting Playwright End-to-End Browser Verification ---');

  // 1. Setup local test server hosting dist build and API endpoints
  const app = express();
  app.use(express.json());
  app.use('/api/v1/fs', fsRouter);
  app.use('/api/v1/git', gitRouter);

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
  console.log(`✓ Test server running on ${baseUrl}`);

  // 2. Launch Playwright headless browser
  console.log('Launching headless Chromium via Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 }, // Mobile viewport for Lazy Terminal
  });
  const page = await context.newPage();

  try {
    // 3. Navigate to app
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    console.log('✓ Successfully loaded Lazy Terminal web client.');

    // 4. Dismiss reconciliation modal if open
    const modalCloseBtn = page.locator('button:has-text("Skip All"), button:has-text("Execute All"), .fixed.inset-0.z-50 button').first();
    if (await modalCloseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Dismissing reconciliation modal overlay...');
      await modalCloseBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Handle initial connection flow if not connected
    const tokenInput = page.locator('input[placeholder*="784-291"]');
    if (await tokenInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Entering connection key into mobile connection flow...');
      await tokenInput.fill('784-291');
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
    await page.waitForTimeout(500);

    // Verify breadcrumb or file elements in Explorer
    const fileItems = page.locator('.truncate');
    await fileItems.first().waitFor({ state: 'visible', timeout: 5000 });
    const count = await fileItems.count();
    assert.ok(count > 0, 'Explorer must display file items');
    console.log(`✓ Explorer rendered file list with ${count} visible elements.`);

    // 7. Test opening a file in the mobile code editor
    const firstFile = page.locator('text=README.md, text=package.json').first();
    if (await firstFile.isVisible()) {
      console.log('Opening file in code editor...');
      await firstFile.click();
      await page.waitForTimeout(500);

      // Verify editor toolbar is visible
      const editorToolbar = page.locator('button:has-text("Edit"), button:has-text("Save")').first();
      await editorToolbar.waitFor({ state: 'visible', timeout: 3000 });
      console.log('✓ Code viewer and editor toolbar active.');

      // Return to file list
      const backBtn = page.locator('button[title*="return to folder"], button[title*="Close file"]').first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // 8. Navigate to Source Control screen
    console.log('Navigating to Source Control screen...');
    const gitTab = page.locator('nav button:has-text("Git")').first();
    await gitTab.click();
    await page.waitForTimeout(1000);

    // Verify Source Control Header & Sync Status
    const sourceControlHeader = page.locator('text=Source Control').first();
    await sourceControlHeader.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Source Control screen active.');

    // Verify Commit Changes button or commit input
    const commitInput = page.locator('input[placeholder*="Commit message"]');
    assert.ok(await commitInput.isVisible(), 'Commit message input must be visible');
    console.log('✓ Commit box verified in Source Control.');

    // Verify Branch selector displays
    const branchBtn = page.locator('button:has-text("main"), button:has-text("ashritha")').first();
    assert.ok(await branchBtn.isVisible(), 'Branch indicator button must be visible');
    const branchText = await branchBtn.textContent();
    console.log(`✓ Git branch selector verified (showing: ${branchText?.trim()}).`);

    console.log('\n======================================================');
    console.log('  PLAYWRIGHT END-TO-END VERIFICATION PASSED (100%)!   ');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runPlaywrightVerification().catch((err) => {
  console.error('\n❌ Playwright E2E Verification Failed:', err);
  process.exit(1);
});
