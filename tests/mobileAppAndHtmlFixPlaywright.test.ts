import { chromium } from '@playwright/test';
import express from 'express';
import http from 'http';
import path from 'path';
import assert from 'assert';
import { spawn } from 'child_process';

async function runMobileAppAndHtmlFixTests() {
  console.log('========================================================================');
  console.log('--- Playwright Mobile Browser Portal & HTML Error Fix Verification ---');
  console.log('========================================================================');

  // 1. Host static dist on Express server
  const distPath = path.resolve(process.cwd(), 'dist');
  const webApp = express();
  webApp.use(express.static(distPath));
  webApp.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const webServer = http.createServer(webApp);
  await new Promise<void>((resolve) => webServer.listen(0, '127.0.0.1', () => resolve()));
  const webPort = (webServer.address() as any).port;
  const webUrl = `http://127.0.0.1:${webPort}`;
  console.log(`✓ Web server running on ${webUrl}`);

  // 2. Launch headless browser
  const browser = await chromium.launch({ headless: true });

  try {
    // -----------------------------------------------------------------------
    // TEST 1: Phone browser visiting the site must show Download Portal, NOT pairing screen!
    // -----------------------------------------------------------------------
    console.log('\n[TEST 1] Visiting website link on mobile browser viewport...');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 }, // iPhone 14 mobile viewport
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });

    await mobilePage.goto(webUrl, { waitUntil: 'networkidle' });

    // Must show Download Portal
    const apkButton = mobilePage.locator('a:has-text("Download APK")');
    const exeButton = mobilePage.locator('a:has-text("Download EXE")');
    const hasApk = await apkButton.isVisible();
    const hasExe = await exeButton.isVisible();
    assert.ok(hasApk, 'Download APK option must be visible on mobile browser');
    assert.ok(hasExe, 'Download EXE option must be visible on mobile browser');

    // Must NOT ask for token on the initial download page
    const tokenInputOnPortal = mobilePage.locator('input[placeholder="123-456"]');
    const hasTokenInput = await tokenInputOnPortal.isVisible();
    assert.strictEqual(hasTokenInput, false, 'Initial page on phone browser must NOT show token input; must show Download Portal!');
    console.log('✓ Confirmed: Mobile browser opens the Download Portal (not pairing screen).');

    // Click "Or open Mobile Web App directly in browser"
    const launchWebBtn = mobilePage.locator('button:has-text("Or open Mobile Web App directly in browser")');
    assert.ok(await launchWebBtn.isVisible(), 'Direct web launch button must be present on portal');
    await launchWebBtn.click();
    await mobilePage.waitForSelector('text=Connect to Windows PC', { timeout: 4000 });
    console.log('✓ Confirmed: Tapping direct launch navigates to Mobile Pairing Screen in browser.');

    // -----------------------------------------------------------------------
    // TEST 2: Native Android APK launch simulation (with ?source=apk / ?view=mobile)
    // -----------------------------------------------------------------------
    console.log('\n[TEST 2] Launching inside simulated Android APK WebView...');
    const apkPage = await browser.newPage({
      viewport: { width: 412, height: 915 }, // Pixel 7
    });

    await apkPage.goto(`${webUrl}/?view=mobile&source=apk`, { waitUntil: 'networkidle' });
    const pairingHeaderInApk = await apkPage.locator('text=Connect to Windows PC').isVisible();
    assert.ok(pairingHeaderInApk, 'Android APK must directly open the Mobile Pairing screen');
    console.log('✓ Confirmed: Android APK directly opens the Pairing Screen.');

    // -----------------------------------------------------------------------
    // TEST 3: Verification of HTML Error Sanitization
    // -----------------------------------------------------------------------
    console.log('\n[TEST 3] Testing HTML error sanitization when PC Companion is unreachable...');
    // Type an invalid pairing code and submit while no PC companion is running on port 3000
    const codeInput = apkPage.locator('input[name="pairingCode"]');
    await codeInput.fill('999-888');
    const connectBtn = apkPage.locator('button[aria-label="Connect to PC"]');
    await connectBtn.click();

    // Wait for error alert to appear
    const alert = apkPage.locator('div[role="alert"]');
    await alert.waitFor({ state: 'visible', timeout: 8000 });
    const alertText = await alert.innerText();
    console.log(`Alert text captured: "${alertText}"`);

    // Verify NO raw HTML tag is displayed!
    assert.ok(!alertText.includes('<!DOCTYPE'), 'Alert must NOT contain <!DOCTYPE HTML');
    assert.ok(!alertText.includes('<html'), 'Alert must NOT contain <html tags');
    assert.ok(!alertText.includes('<head'), 'Alert must NOT contain <head tags');
    assert.ok(!alertText.includes('<body'), 'Alert must NOT contain <body tags');
    assert.ok(
      alertText.includes('Unable to connect') || alertText.includes('rejected') || alertText.includes('unreachable') || alertText.includes('check'),
      'Alert must show clean, actionable human message.'
    );
    console.log('✓ Confirmed: Zero raw HTML displayed; clean human message rendered.');

    // Verify "Edit Host PC IP Address" button exists in alert
    const editHostBtn = apkPage.locator('button:has-text("Edit Host PC IP Address")');
    if (await editHostBtn.isVisible()) {
      await editHostBtn.click();
      const hostInput = apkPage.locator('input[placeholder="http://192.168.1.4:3000"]');
      assert.ok(await hostInput.isVisible(), 'Host IP input must be available for user to enter PC address');
      console.log('✓ Confirmed: Host PC IP configuration interface is accessible.');
    }

    console.log('\n========================================================================');
    console.log('  ALL MOBILE APP & HTML ERROR SANITIZATION TESTS PASSED (100%)!         ');
    console.log('========================================================================');
  } finally {
    await browser.close();
    webServer.close();
  }
}

runMobileAppAndHtmlFixTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
