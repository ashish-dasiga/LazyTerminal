const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDownloadsDir = path.join(rootDir, 'public', 'downloads');

console.log('[build_windows_exe] Bundling host server with esbuild...');
execSync('npx esbuild src/host/companionServer.ts --bundle --platform=node --format=cjs --outfile=dist/companionServer.cjs', {
  cwd: rootDir,
  stdio: 'inherit'
});

const seaConfig = {
  main: 'dist/companionServer.cjs',
  output: 'dist/sea-prep.blob',
  disableExperimentalSEAWarning: true
};
fs.writeFileSync(path.join(distDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2), 'utf8');

console.log('[build_windows_exe] Generating SEA blob...');
execSync('node --experimental-sea-config dist/sea-config.json', {
  cwd: rootDir,
  stdio: 'inherit'
});

const nodePath = process.execPath;
const targetExe = path.join(distDir, 'LazyTerminal-Windows-Setup.exe');
console.log(`[build_windows_exe] Copying Node base from ${nodePath} to ${targetExe}...`);
fs.copyFileSync(nodePath, targetExe);

console.log('[build_windows_exe] Injecting SEA blob into executable...');
execSync(`npx --yes postject "${targetExe}" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
  cwd: rootDir,
  stdio: 'inherit'
});

if (!fs.existsSync(publicDownloadsDir)) {
  fs.mkdirSync(publicDownloadsDir, { recursive: true });
}

const publicExe = path.join(publicDownloadsDir, 'LazyTerminal-Windows-Setup.exe');
fs.copyFileSync(targetExe, publicExe);
console.log(`[build_windows_exe] Successfully created and copied executable to ${publicExe} (${(fs.statSync(publicExe).size / (1024 * 1024)).toFixed(1)} MB)`);
