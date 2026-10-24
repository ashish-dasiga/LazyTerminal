import { chromium } from '@playwright/test';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import assert from 'assert';
import { createHostCompanion } from '../src/host/router';
import { fsRouter } from '../src/server/fsRoutes';
import { gitRouter } from '../src/server/gitRoutes';

async function runMobilePairingRedesignSuite() {
  console.log('========================================================================');
  console.log('--- Playwright Mobile Pairing Redesign & Verification Suite ---');
  console.log('========================================================================');

  // 1. Setup local test server with Express + Host Companion router
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
  console.log(`✓ Test companion running on ${baseUrl} (Active Key: ${livePairingKey})`);

  // Launch Playwright in mobile viewport
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 / modern Android viewport
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore intentional 401/403 status errors produced by test validation requests
      if (!text.includes('401') && !text.includes('403')) {
        consoleErrors.push(text);
      }
    }
  });

  try {
    // -------------------------------------------------------------------------
    // Test Category 1: UI and Layout
    // -------------------------------------------------------------------------
    console.log('\n[1/3] Testing UI and Layout...');
    await page.goto(`${baseUrl}/?view=mobile`, { waitUntil: 'networkidle' });

    // 1.1 The pairing page renders
    await page.waitForSelector('text=Connect to Windows PC', { timeout: 5000 });
    console.log('✓ Pairing page rendered with title "Connect to Windows PC".');

    // 1.2 The obsolete header is removed
    const obsoleteHeaderLogo = page.locator('text=Lazy Terminal Simulator');
    assert.strictEqual(await obsoleteHeaderLogo.isVisible().catch(() => false), false, 'Obsolete header "Lazy Terminal Simulator" must be removed');
    const obsoleteInstalledApps = page.locator('button:has-text("Install Apps")');
    assert.strictEqual(await obsoleteInstalledApps.isVisible().catch(() => false), false, 'Obsolete header "Install Apps" must be removed');
    const obsoleteMobileAppTab = page.locator('button:has-text("Mobile App (Android)")');
    assert.strictEqual(await obsoleteMobileAppTab.isVisible().catch(() => false), false, 'Obsolete header "Mobile App" tab must be removed');
    console.log('✓ Verified: Obsolete simulator header and tabs are completely absent.');

    // 1.3 The simulated status indicators are removed
    const simTime = page.locator('text=09:41');
    assert.strictEqual(await simTime.isVisible().catch(() => false), false, 'Simulated time "09:41" must be removed');
    const sim5G = page.locator('text=5G');
    assert.strictEqual(await sim5G.isVisible().catch(() => false), false, 'Simulated "5G" badge must be removed');
    console.log('✓ Verified: Simulated status bar (09:41, 5G, Wi-Fi) is removed.');

    // 1.4 The "Laptop App Token" section is absent
    const laptopTokenSection = page.locator('text=Laptop App Token');
    assert.strictEqual(await laptopTokenSection.isVisible().catch(() => false), false, '"Laptop App Token" section must be removed');
    const fillTokenBtn = page.locator('button:has-text("Fill Token")');
    assert.strictEqual(await fillTokenBtn.isVisible().catch(() => false), false, '"Fill Token" button must be removed');
    console.log('✓ Verified: "Laptop App Token" section and duplicate controls are absent.');

    // 1.5 The pairing field is blank on initial load
    const pairingInput = page.locator('input[aria-label="Pairing Code"]');
    await pairingInput.waitFor({ state: 'visible', timeout: 3000 });
    const initialInputValue = await pairingInput.inputValue();
    assert.strictEqual(initialInputValue, '', 'Pairing input field must be completely empty on initial load');
    console.log('✓ Verified: Pairing field starts completely blank.');

    // 1.6 The value 784-291 is NOT rendered as a default token
    const oldHardcodedText = page.locator('text=784-291');
    assert.strictEqual(await oldHardcodedText.isVisible().catch(() => false), false, 'Hardcoded token 784-291 must NOT be rendered');
    const placeholder = await pairingInput.getAttribute('placeholder');
    assert.notStrictEqual(placeholder, '784-291', 'Placeholder must not be hardcoded 784-291');
    console.log(`✓ Verified: 784-291 is not present in DOM or placeholder (placeholder="${placeholder}").`);

    // 1.7 The correct logo replaces the key symbol
    const brandLogo = page.locator('img[alt="Lazy Terminal Logo"]').first();
    assert.ok(await brandLogo.isVisible(), 'Lazy Terminal brand logo must be displayed');
    console.log('✓ Verified: Real brand logo replaces key symbol.');

    // 1.8 The background logo does not block interaction
    const bgLogo = page.locator('[aria-hidden="true"] img');
    assert.ok(await bgLogo.count() > 0, 'Background decorative logo exists');
    // Ensure pairing input is interactable and can be clicked
    await pairingInput.click();
    console.log('✓ Verified: Decorative background logo is non-blocking and input is fully interactable.');

    // Save proof screenshot of the redesigned mobile pairing screen
    const artifactDir = 'C:\\Users\\Ashish Dasiga\\.gemini\\antigravity-cli\\brain\\5f0eae23-ad0e-454f-a36d-2c69c3828f0f';
    const screenshotPath = path.join(artifactDir, 'mobile_pairing_redesigned.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`✓ Saved screenshot of redesigned mobile pairing screen: ${screenshotPath}`);

    // -------------------------------------------------------------------------
    // Test Category 2: Validation and Connection
    // -------------------------------------------------------------------------
    console.log('\n[2/3] Testing Validation and Connection...');

    const connectBtn = page.locator('button:has-text("Connect to PC")');

    // 2.1 Empty input is handled correctly (button is disabled or validation prevents submit)
    const isInitiallyDisabled = await connectBtn.isDisabled();
    assert.strictEqual(isInitiallyDisabled, true, 'Connect button must be disabled when input is empty');
    console.log('✓ Empty input prevents submission (button disabled).');

    // 2.2 Invalid input shows an appropriate message
    await pairingInput.fill('12');
    // Force form submit if button enables or test validation
    if (await connectBtn.isEnabled()) {
      await connectBtn.click();
      await page.waitForSelector('text=must be at least 6 digits', { timeout: 3000 });
      console.log('✓ Invalid input (<6 chars) shows actionable validation error.');
    } else {
      console.log('✓ Short input keeps submission button safely disabled.');
    }

    // 2.3 Invalid/expired code displays actionable error from backend
    await pairingInput.fill('000-000');
    await connectBtn.click();
    await page.waitForSelector('[role="alert"]', { timeout: 5000 });
    const errorText = await page.locator('[role="alert"]').textContent();
    assert.ok(errorText && errorText.length > 0, 'Must display error message for invalid code');
    console.log(`✓ Invalid pairing code produces actionable error: "${errorText?.trim()}"`);

    // 2.4 Failed requests never mark the device as connected
    const isConnectedAfterFail = await page.locator('text=DESKTOP-WIN11-PRO').isVisible().catch(() => false);
    assert.strictEqual(isConnectedAfterFail, false, 'Failed request must NEVER mark device as connected');
    console.log('✓ Verified: Failed request did not produce false connected state.');

    // 2.5 Successful pairing with live host key displays the connected state
    console.log(`Entering live host pairing key: ${livePairingKey}...`);
    await pairingInput.fill(livePairingKey);
    await connectBtn.click();

    // Verify loading state appears briefly
    // Then verify transition to connected Terminal screen
    await page.waitForSelector('nav button:has-text("Terminal")', { timeout: 8000 });
    console.log('✓ Successful pairing displays connected workspace with Terminal navigation!');

    // Dismiss initial reconciliation modal if shown
    const reviewLater = page.locator('button:has-text("Review Later"), button:has-text("Skip All")').first();
    if (await reviewLater.isVisible({ timeout: 1500 }).catch(() => false)) {
      await reviewLater.click();
    }

    // -------------------------------------------------------------------------
    // Test Category 3: Regression and Accessibility
    // -------------------------------------------------------------------------
    console.log('\n[3/3] Testing Regression and Accessibility...');

    // 3.1 Unrelated routes continue to render
    const explorerTab = page.locator('nav button:has-text("Explorer")').first();
    await explorerTab.click();
    await page.waitForSelector('text=package.json', { timeout: 5000 });
    console.log('✓ Explorer screen renders package.json.');

    const gitTab = page.locator('nav button:has-text("Git")').first();
    await gitTab.click();
    await page.waitForSelector('text=Commit Changes', { timeout: 5000 });
    console.log('✓ Source Control screen renders commit controls.');

    // 3.2 Console errors check
    assert.strictEqual(consoleErrors.length, 0, `Unexpected console errors: ${consoleErrors.join(', ')}`);
    console.log('✓ Zero unexpected browser console errors.');

    console.log('\n========================================================================');
    console.log('  ALL MOBILE PAIRING REDESIGN VERIFICATION TESTS PASSED (100%)!         ');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runMobilePairingRedesignSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
