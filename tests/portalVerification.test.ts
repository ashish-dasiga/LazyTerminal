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

async function verifyInstallationPortal() {
  console.log('--- Starting Installation Portal Browser Verification ---');

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
  const baseUrl = `http://127.0.0.1:${port}?view=portal`;
  console.log(`✓ Installation portal test server running on ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }, // Desktop viewport for install portal
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    console.log('✓ Successfully loaded installation portal.');

    // 1. Verify Branding & App Icon
    const brandTitle = page.locator('h1:has-text("Lazy Terminal")').first();
    await brandTitle.waitFor({ state: 'visible', timeout: 5000 });
    const appIcon = page.locator('img[src="/icon.jpeg"]').first();
    assert.ok(await appIcon.isVisible(), 'App icon (icon.jpeg) must be visible in header/hero');
    console.log('✓ Brand title and official app icon (/icon.jpeg) verified.');

    // 2. Verify Android Mobile Section
    const androidHeader = page.locator('text=Android Mobile App Installation').first();
    assert.ok(await androidHeader.isVisible(), 'Android Mobile installation section must be present');

    const pwaBtn = page.locator('button:has-text("Install to Android Home Screen"), button:has-text("Installed on this Device")').first();
    assert.ok(await pwaBtn.isVisible(), 'PWA Home Screen Install button must be present');

    const apkBtn = page.locator('a[download="lazy-terminal-debug.apk"]').first();
    assert.ok(await apkBtn.isVisible(), 'APK Package download link must be present');

    const qrCodeSvg = page.locator('svg').first();
    assert.ok(await qrCodeSvg.isVisible(), 'QR Code SVG must be rendered for instant mobile scan');
    console.log('✓ Android Mobile section verified (PWA installer, APK download, and LAN QR Code).');

    // 3. Verify Windows PC Section
    const windowsHeader = page.locator('text=Windows PC Companion Installation').first();
    assert.ok(await windowsHeader.isVisible(), 'Windows PC Companion installation section must be present');

    const zipBtn = page.locator('a[download="LazyTerminal-Windows-Companion.zip"]').first();
    assert.ok(await zipBtn.isVisible(), 'Companion ZIP download button must be present');

    const batBtn = page.locator('a[download="LazyTerminal-Windows-Setup.bat"]').first();
    assert.ok(await batBtn.isVisible(), 'Setup.bat launcher download button must be present');

    const psCode = page.locator('pre:has-text("powershell")').first();
    assert.ok(await psCode.isVisible(), 'PowerShell one-liner command box must be present');
    console.log('✓ Windows PC section verified (Companion ZIP, Setup.bat, and PowerShell one-liner).');

    // 4. Verify In-Browser Studio Launchers
    const launchMobileBtn = page.locator('text=Launch Mobile Phone UI').first();
    assert.ok(await launchMobileBtn.isVisible(), 'Launch Mobile Phone UI card must be present');

    const launchLaptopBtn = page.locator('text=Launch Laptop Desktop IDE').first();
    assert.ok(await launchLaptopBtn.isVisible(), 'Launch Laptop Desktop IDE card must be present');
    console.log('✓ In-browser Dual-Frontend launch cards verified.');

    // 5. Test Switching to Laptop App View
    await launchLaptopBtn.click();
    await page.waitForTimeout(500);
    const laptopView = page.locator('text=DESKTOP-WIN11-PRO').first();
    assert.ok(await laptopView.isVisible({ timeout: 5000 }), 'Laptop desktop app view must render after clicking launch');
    console.log('✓ Seamless transition to Laptop App verified.');

    // 6. Test Switching back to Install Portal
    const portalTab = page.locator('button:has-text("Install Apps")').first();
    await portalTab.click();
    await page.waitForTimeout(400);
    assert.ok(await brandTitle.isVisible(), 'Should switch back to Install Portal cleanly');
    console.log('✓ Seamless return to Install Portal verified.');

    // Capture screenshot for visual verification
    await page.screenshot({ path: 'portal_verification_desktop.png' });
    console.log('✓ Saved desktop screenshot: portal_verification_desktop.png');

    console.log('\n======================================================');
    console.log('  INSTALLATION PORTAL VERIFICATION PASSED (100%)!     ');
    console.log('======================================================\n');
  } finally {
    hostCompanion.shutdown();
    await browser.close();
    server.close();
  }
}

verifyInstallationPortal().catch((err) => {
  console.error('\n❌ Portal Verification Failed:', err);
  process.exit(1);
});
