const { chromium } = require('@playwright/test');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

async function testSimplifiedPortal() {
  console.log('=== Verifying Simplified Download Portal (2 Options Only) ===');

  const app = express();
  const distPath = path.join(process.cwd(), 'dist');
  assert.ok(fs.existsSync(distPath), 'dist/ directory must exist');
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  
  try {
    // 1. Desktop Viewport Test
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    console.log('1. Verifying Clean Title & Icon Theme...');
    await page.waitForSelector('text=Lazy Terminal', { timeout: 5000 });
    const imgVisible = await page.locator('img[alt="Lazy Terminal Icon"]').isVisible();
    assert.ok(imgVisible, 'App icon must be visible');

    console.log('2. Verifying EXACTLY 2 download options...');
    const downloadApk = page.locator('a:has-text("Download APK")');
    const downloadExe = page.locator('a:has-text("Download EXE")');
    assert.ok(await downloadApk.isVisible(), 'Download APK option must exist');
    assert.ok(await downloadExe.isVisible(), 'Download EXE option must exist');

    // Verify there are no extra options or tabs
    const allLinks = await page.locator('a').all();
    console.log(`Total download links on page: ${allLinks.length}`);
    assert.strictEqual(allLinks.length, 2, 'There must be EXACTLY 2 download options on the page!');

    // Check APK link href
    const apkHref = await downloadApk.getAttribute('href');
    console.log(`APK link href: ${apkHref}`);
    assert.ok(apkHref.includes('LazyTerminal.apk'), 'APK link must point to LazyTerminal.apk');

    // Check EXE link href
    const exeHref = await downloadExe.getAttribute('href');
    console.log(`EXE link href: ${exeHref}`);
    assert.ok(exeHref.includes('LazyTerminal-Windows-Setup.exe'), 'EXE link must point to LazyTerminal-Windows-Setup.exe');

    // Verify downloaded APK file validity on disk
    console.log('3. Validating APK package on disk...');
    const apkPath = path.join(distPath, 'downloads', 'LazyTerminal.apk');
    assert.ok(fs.existsSync(apkPath), 'LazyTerminal.apk must exist in dist/downloads');
    const apkStats = fs.statSync(apkPath);
    console.log(`APK Size: ${apkStats.size} bytes (${(apkStats.size / 1024).toFixed(1)} KB)`);
    assert.ok(apkStats.size > 50000, 'APK must be a real compiled binary (> 50KB)');

    // Verify downloaded EXE file validity on disk
    console.log('4. Validating EXE package on disk...');
    const exePath = path.join(distPath, 'downloads', 'LazyTerminal-Windows-Setup.exe');
    assert.ok(fs.existsSync(exePath), 'LazyTerminal-Windows-Setup.exe must exist in dist/downloads');
    const exeStats = fs.statSync(exePath);
    console.log(`EXE Size: ${exeStats.size} bytes (${(exeStats.size / 1024).toFixed(1)} KB)`);
    assert.ok(exeStats.size > 10000, 'EXE must be a real PE executable (> 10KB)');

    // Capture screenshots for design review
    const screenshotDesktop = path.join('C:\\Users\\Ashish Dasiga\\.gemini\\antigravity-cli\\brain\\91de9501-3fb7-4ce7-9630-6b4aa46f630a', 'simplified_portal_desktop.png');
    await page.screenshot({ path: screenshotDesktop, fullPage: true });
    console.log(`Saved desktop screenshot: ${screenshotDesktop}`);

    // Mobile Viewport Screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    const screenshotMobile = path.join('C:\\Users\\Ashish Dasiga\\.gemini\\antigravity-cli\\brain\\91de9501-3fb7-4ce7-9630-6b4aa46f630a', 'simplified_portal_mobile.png');
    await page.screenshot({ path: screenshotMobile, fullPage: true });
    console.log(`Saved mobile screenshot: ${screenshotMobile}`);

    console.log('\n--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ---');
  } finally {
    await browser.close();
    server.close();
  }
}

testSimplifiedPortal().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
