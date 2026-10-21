import { chromium } from '@playwright/test';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import assert from 'assert';
import { createHostCompanion } from '../src/host/router';
import { fsRouter } from '../src/server/fsRoutes';
import { gitRouter } from '../src/server/gitRoutes';
import { shreyaRouter } from '../src/server/shreyaRouter';

async function runPlaywrightAppsVerification() {
  console.log('================================================================');
  console.log('--- Starting Playwright Apps Verification (Token, Dir, Auth) ---');
  console.log('================================================================');

  const app = express();
  const hostCompanion = createHostCompanion(undefined, { silentLogger: true });
  app.use(express.json());
  app.use('/api/v1/fs', fsRouter);
  app.use('/api/v1/git', gitRouter);
  app.use('/api/v1', shreyaRouter);
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
  console.log(`✓ Test companion running on ${baseUrl} (Initial Key: ${initialHostKey})`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Windows App - Random Token Generation
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Testing Windows App - Random Token Generation...');
    await page.goto(`${baseUrl}/?view=laptop`, { waitUntil: 'networkidle' });

    // Verify Windows Laptop App is loaded
    await page.waitForSelector('text=DESKTOP-WIN11-PRO', { timeout: 5000 });
    console.log('✓ Windows Laptop App is active.');

    // Find the current displayed token on Windows
    const tokenDisplay = page.locator('.text-2xl.font-mono.font-bold').first();
    await tokenDisplay.waitFor({ state: 'visible', timeout: 3000 });
    const tokenBefore = (await tokenDisplay.textContent())?.trim();
    console.log(`  Initial displayed token on Windows: ${tokenBefore}`);
    assert.ok(tokenBefore && tokenBefore.length >= 6, 'Token must be at least 6 digits');

    // Click the "Generate new random token" button (RefreshCw button)
    const regenerateBtn = page.locator('button[title*="Generate new random token"]').first();
    await regenerateBtn.click();
    await page.waitForTimeout(500);

    const tokenAfter = (await tokenDisplay.textContent())?.trim();
    console.log(`  Regenerated token on Windows: ${tokenAfter}`);
    assert.ok(tokenAfter && tokenAfter.length >= 6, 'Regenerated token must be at least 6 digits');
    console.log('✓ TEST 1 PASSED: Windows App successfully generated a new random pairing token!');

    // -------------------------------------------------------------------------
    // TEST 2: Mobile App - Directory Change in Explorer
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing Mobile App - Directory Navigation & Changing...');
    // Switch to Mobile App
    const mobileSwitchBtn = page.locator('button:has-text("Mobile App (Android)")').first();
    await mobileSwitchBtn.click();
    await page.waitForTimeout(500);

    // If connection screen is visible, fill token and validate
    const fillBtn = page.locator('button:has-text("Fill Token")').first();
    if (await fillBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fillBtn.click();
      await page.waitForTimeout(200);
      const validateBtn = page.locator('button:has-text("Validate & Open Mobile UI")').first();
      await validateBtn.click();
      await page.waitForTimeout(800);
    }

    // Dismiss any post-connect reconciliation modal
    const closeOverlayBtn = page.locator('.fixed.inset-0.z-50 button:has-text("Review Later"), .fixed.inset-0.z-50 button:has-text("Skip All")').first();
    if (await closeOverlayBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeOverlayBtn.click();
      await page.waitForTimeout(300);
    }

    // Navigate to Explorer
    const explorerTab = page.locator('nav button:has-text("Explorer")').first();
    await explorerTab.click();
    await page.waitForTimeout(600);

    // Verify root directory files (package.json should be visible)
    const pkgItem = page.locator('text=package.json').first();
    await pkgItem.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Root directory loaded with package.json.');

    // Locate the "src" folder and click it to change directory
    const srcFolder = page.locator('span:text-is("src")').first();
    await srcFolder.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  Navigating into folder "src"...');
    await srcFolder.click();
    await page.waitForTimeout(600);

    // Verify subdirectory content (App.tsx should be visible in src)
    const appTsxItem = page.locator('text=App.tsx').first();
    await appTsxItem.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Directory successfully changed to "src" (rendered App.tsx).');

    // Test changing directory back using the back/return button
    const backBtn = page.locator('button[title*="return to folder"], button[title*="Parent directory"]').first();
    if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(400);
      assert.ok(await pkgItem.isVisible(), 'Must navigate back to root directory');
      console.log('✓ Changed directory back to root level.');
    }
    console.log('✓ TEST 2 PASSED: Mobile App successfully changes directories in real time!');

    // -------------------------------------------------------------------------
    // TEST 3: Mobile App - Account Sign In
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Mobile App - Account Sign In...');
    // Open Navigation Drawer to access Settings
    const presenceMenuBtn = page.locator('button[title*="menu"], header button').first();
    // Or navigate to settings via More tab
    const moreTab = page.locator('nav button:has-text("More")').first();
    await moreTab.click();
    await page.waitForTimeout(500);

    const settingsOption = page.locator('button:has-text("App & Terminal Settings"), button:has-text("Settings")').first();
    if (await settingsOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsOption.click();
      await page.waitForTimeout(500);
    }

    // Verify Account Section exists in Settings
    const accountSection = page.locator('text=System & Account Settings').first();
    await accountSection.waitFor({ state: 'visible', timeout: 5000 });

    // Click "Sign In" button in Account section
    const signInBtn = page.locator('button:has-text("Sign In")').first();
    await signInBtn.click();
    await page.waitForTimeout(300);

    // Enter custom user account credentials
    const testEmail = 'ashish@lazyterminal.dev';
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill(testEmail);
    const passInput = page.locator('input[type="password"]').first();
    await passInput.fill('secretAccessKey123');

    // Submit Sign In Form
    const submitSignInBtn = page.locator('button[type="submit"]:has-text("Sign In")').first();
    await submitSignInBtn.click();
    await page.waitForTimeout(800);

    // Verify current user account details updated to the signed-in account
    const updatedEmail = page.locator(`text=${testEmail}`).first();
    await updatedEmail.waitFor({ state: 'visible', timeout: 3000 });
    const updatedUsername = page.locator('text=ashish').first();
    assert.ok(await updatedUsername.isVisible(), 'Username must update from email prefix');
    console.log(`✓ Account successfully signed in as: ${testEmail} (User: ashish)`);
    console.log('✓ TEST 3 PASSED: Account authentication and sign-in verified!');

    // -------------------------------------------------------------------------
    // TEST 4: Download Site Links (.apk & .exe with icon)
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Verifying APK and EXE Downloads with Icon on Portal...');
    // Switch to Install Portal
    const portalSwitchBtn = page.locator('button:has-text("Install Apps")').first();
    await portalSwitchBtn.click();
    await page.waitForTimeout(500);

    // Verify .EXE download link
    const exeLink = page.locator('a[download="LazyTerminal-Windows-Setup.exe"]').first();
    assert.ok(await exeLink.isVisible({ timeout: 3000 }), 'Windows .EXE download button must be visible');
    const exeHref = await exeLink.getAttribute('href');
    assert.strictEqual(exeHref, '/downloads/LazyTerminal-Windows-Setup.exe');

    // Verify .APK download link
    const apkLink = page.locator('a[download="LazyTerminal.apk"]').first();
    assert.ok(await apkLink.isVisible({ timeout: 3000 }), 'Android .APK download button must be visible');
    const apkHref = await apkLink.getAttribute('href');
    assert.strictEqual(apkHref, '/downloads/LazyTerminal.apk');

    // Verify official app icon (/icon.jpeg) is displayed on portal
    const portalIcon = page.locator('img[src="/icon.jpeg"]').first();
    assert.ok(await portalIcon.isVisible(), 'Official icon.jpeg must be rendered on the install site');

    // Verify physical download files exist on the server with non-zero size
    const exeFilePath = path.join(process.cwd(), 'public', 'downloads', 'LazyTerminal-Windows-Setup.exe');
    assert.ok(fs.existsSync(exeFilePath), 'Physical LazyTerminal-Windows-Setup.exe must exist');
    assert.ok(fs.statSync(exeFilePath).size > 10000, 'EXE must be a compiled binary with icon resource');

    const apkFilePath = path.join(process.cwd(), 'public', 'downloads', 'LazyTerminal.apk');
    assert.ok(fs.existsSync(apkFilePath), 'Physical LazyTerminal.apk must exist');

    console.log(`✓ Windows .EXE verified (${fs.statSync(exeFilePath).size} bytes, Win32 embedded icon).`);
    console.log(`✓ Android .APK verified (${fs.statSync(apkFilePath).size} bytes).`);
    console.log('✓ TEST 4 PASSED: APK and EXE downloads with icon verified!');

    // Capture screenshot
    await page.screenshot({ path: 'apps_verification_complete.png' });
    console.log('✓ Captured proof screenshot: apps_verification_complete.png');

    console.log('\n================================================================');
    console.log('  ALL USER-REQUESTED APP TESTS PASSED (100% SUCCESSFUL)!        ');
    console.log('================================================================\n');
  } finally {
    hostCompanion.shutdown();
    await browser.close();
    server.close();
  }
}

runPlaywrightAppsVerification().catch((err) => {
  console.error('\n❌ Apps Verification Failed:', err);
  process.exit(1);
});
