const { spawn } = require('child_process');

const sdkmanager = 'C:\\Users\\Ashish Dasiga\\tools\\android-sdk\\cmdline-tools\\latest\\bin\\sdkmanager.bat';
const sdkRoot = 'C:\\Users\\Ashish Dasiga\\tools\\android-sdk';
const javaHome = 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot';

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
