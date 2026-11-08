const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const distElectronDir = path.join(rootDir, 'dist-electron');
const distInstallerDir = path.join(rootDir, 'dist-installer');
const publicDownloadsDir = path.join(rootDir, 'public', 'downloads');

[distDir, distElectronDir, distInstallerDir, publicDownloadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('============================================================');
console.log(' Lazy Terminal — Packaging Windows Desktop Application');
console.log('============================================================\n');

// 1. Build Vite production bundle
console.log('[1/4] Building production React frontend with Vite...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Bundle Host Companion server
console.log('\n[2/4] Bundling Host Companion backend with esbuild...');
execSync(
  'npx esbuild src/host/companionServer.ts --bundle --platform=node --format=cjs --outfile=dist-electron/companionServer.cjs --external:electron',
  { cwd: rootDir, stdio: 'inherit' }
);

// Copy Electron desktop files
fs.copyFileSync(
  path.join(rootDir, 'src', 'desktop', 'main.cjs'),
  path.join(distElectronDir, 'main.cjs')
);
fs.copyFileSync(
  path.join(rootDir, 'src', 'desktop', 'preload.cjs'),
  path.join(distElectronDir, 'preload.cjs')
);
if (fs.existsSync(path.join(publicDownloadsDir, 'app_icon.ico'))) {
  fs.copyFileSync(
    path.join(publicDownloadsDir, 'app_icon.ico'),
    path.join(distElectronDir, 'app_icon.ico')
  );
}

// 3. Package Windows desktop application and NSIS installer with electron-builder
console.log('\n[3/4] Building standalone Windows Desktop Executable & NSIS Setup Wizard...');
execSync('npx electron-builder --win --x64', {
  cwd: rootDir,
  stdio: 'inherit',
});

// 4. Verify deliverables and publish to public/downloads
console.log('\n[4/4] Verifying generated installer and standalone executable...');
const installerSrc = path.join(distInstallerDir, 'LazyTerminal-Windows-Setup.exe');
const installerDest = path.join(publicDownloadsDir, 'LazyTerminal-Windows-Setup.exe');

if (fs.existsSync(installerSrc)) {
  fs.copyFileSync(installerSrc, installerDest);
  const sizeMb = (fs.statSync(installerDest).size / (1024 * 1024)).toFixed(2);
  console.log(`✓ Windows NSIS Installer ready: ${installerDest} (${sizeMb} MB)`);
} else {
  // Check for any .exe in distInstallerDir
  const exes = fs.readdirSync(distInstallerDir).filter((f) => f.endsWith('.exe'));
  if (exes.length > 0) {
    const src = path.join(distInstallerDir, exes[0]);
    fs.copyFileSync(src, installerDest);
    console.log(`✓ Copied ${exes[0]} -> ${installerDest}`);
  } else {
    throw new Error('No installer .exe found in dist-installer directory!');
  }
}

const unpackedExe = path.join(distInstallerDir, 'win-unpacked', 'Lazy Terminal.exe');
if (fs.existsSync(unpackedExe)) {
  console.log(`✓ Standalone Windows Desktop App ready: ${unpackedExe}`);
}

console.log('\n============================================================');
console.log(' Lazy Terminal Windows Desktop Packaging Complete!');
console.log('============================================================\n');
