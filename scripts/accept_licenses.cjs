const { spawn } = require('child_process');
const path = require('path');

const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Default';
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(userHome, 'tools', 'android-sdk');
const sdkmanager = path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');
const javaHome = process.env.JAVA_HOME || 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot';

console.log('Accepting licenses...');
const p = spawn(`"${sdkmanager}"`, [`--sdk_root="${sdkRoot}"`, '--licenses'], {
  env: { ...process.env, JAVA_HOME: javaHome },
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe']
});

p.stdout.on('data', d => {
  const s = d.toString();
  process.stdout.write(s);
  if (s.includes('(y/N)?') || s.includes('Accept? (y/N):')) {
    p.stdin.write('y\n');
  }
});

p.stderr.on('data', d => process.stderr.write(d.toString()));

p.on('close', code => {
  console.log('\nLicenses process exited with code:', code);
});
