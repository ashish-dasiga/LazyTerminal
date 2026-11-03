const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDownloadsDir = path.join(rootDir, 'public', 'downloads');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(publicDownloadsDir)) {
  fs.mkdirSync(publicDownloadsDir, { recursive: true });
}

console.log('[build_windows_exe] 1/4 Bundling host companion with esbuild...');
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

console.log('[build_windows_exe] 2/4 Generating SEA preparation blob...');
execSync('node --experimental-sea-config dist/sea-config.json', {
  cwd: rootDir,
  stdio: 'inherit'
});

const nodePath = process.execPath;
const targetHostExe = path.join(distDir, 'LazyTerminal-Windows-Host.exe');
console.log(`[build_windows_exe] Copying Node base to ${targetHostExe}...`);
fs.copyFileSync(nodePath, targetHostExe);

console.log('[build_windows_exe] 3/4 Injecting SEA blob into Host engine executable...');
execSync(`npx --yes postject "${targetHostExe}" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
  cwd: rootDir,
  stdio: 'inherit'
});

const publicHostExe = path.join(publicDownloadsDir, 'LazyTerminal-Windows-Host.exe');
fs.copyFileSync(targetHostExe, publicHostExe);
console.log(`[build_windows_exe] Host engine binary ready: ${publicHostExe} (${(fs.statSync(publicHostExe).size / (1024 * 1024)).toFixed(1)} MB)`);

console.log('[build_windows_exe] 4/4 Compiling Native Windows Desktop GUI Window (WPF) with csc.exe...');
const wpfDir = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\WPF';
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const targetGuiExe = path.join(distDir, 'LazyTerminal-Windows-Setup.exe');
const sourceCs = path.join(rootDir, 'src', 'windows', 'LazyTerminalHostWindow.cs');
const iconPath = path.join(publicDownloadsDir, 'app_icon.ico');

const compileCmd = `"${cscPath}" /target:winexe "/r:${wpfDir}\\PresentationFramework.dll" "/r:${wpfDir}\\PresentationCore.dll" "/r:${wpfDir}\\WindowsBase.dll" /r:System.Xaml.dll /r:System.Drawing.dll /win32icon:"${iconPath}" /out:"${targetGuiExe}" "${sourceCs}"`;
execSync(compileCmd, {
  cwd: rootDir,
  stdio: 'inherit'
});

const publicGuiExe = path.join(publicDownloadsDir, 'LazyTerminal-Windows-Setup.exe');
fs.copyFileSync(targetGuiExe, publicGuiExe);
console.log(`[build_windows_exe] Native Desktop GUI Window ready: ${publicGuiExe} (${(fs.statSync(publicGuiExe).size / 1024).toFixed(1)} KB)`);
