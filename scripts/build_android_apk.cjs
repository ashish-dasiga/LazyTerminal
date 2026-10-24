const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build_android');
const SDK_DIR = 'C:\\Users\\Ashish Dasiga\\tools\\android-sdk';
const BUILD_TOOLS = path.join(SDK_DIR, 'build-tools', '34.0.0');
const ANDROID_JAR = path.join(SDK_DIR, 'platforms', 'android-34-2', 'android.jar');
const JAVA_BIN = 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot\\bin';
const KEYSTORE = 'C:\\Users\\Ashish Dasiga\\.android\\debug.keystore';

const aapt2 = path.join(BUILD_TOOLS, 'aapt2.exe');
const d8 = path.join(BUILD_TOOLS, 'd8.bat');
const zipalign = path.join(BUILD_TOOLS, 'zipalign.exe');
const apksigner = path.join(BUILD_TOOLS, 'apksigner.bat');
const javac = path.join(JAVA_BIN, 'javac.exe');
const jar = path.join(JAVA_BIN, 'jar.exe');

console.log('=== Building Real Installable Android APK (Universal Compatibility) ===');

// 1. Prepare directory structure
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
fs.mkdirSync(path.join(BUILD_DIR, 'res', 'drawable'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'res', 'values'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'src', 'com', 'lazyterm', 'app'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'bin', 'classes'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'bin', 'dex'), { recursive: true });
fs.mkdirSync(path.join(BUILD_DIR, 'assets', 'www'), { recursive: true });

// 2. Generate icon PNG from icon.jpeg
console.log('1. Preparing icon asset...');
try {
  execSync(`powershell -Command "Add-Type -AssemblyName System.Drawing; ` +
    `$img = [System.Drawing.Image]::FromFile('${path.join(PROJECT_ROOT, 'icon.jpeg')}'); ` +
    `$bmp = New-Object System.Drawing.Bitmap 192, 192; ` +
    `$g = [System.Drawing.Graphics]::FromImage($bmp); ` +
    `$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; ` +
    `$g.DrawImage($img, 0, 0, 192, 192); ` +
    `$bmp.Save('${path.join(BUILD_DIR, 'res', 'drawable', 'icon.png')}', [System.Drawing.Imaging.ImageFormat]::Png); ` +
    `$g.Dispose(); $bmp.Dispose(); $img.Dispose();"`, { stdio: 'inherit' });
} catch (e) {
  console.warn('Fallback: Copy existing app_icon_192.png if present');
  fs.copyFileSync(path.join(PROJECT_ROOT, 'public', 'app_icon_192.png'), path.join(BUILD_DIR, 'res', 'drawable', 'icon.png'));
}

// 3. Write strings.xml
fs.writeFileSync(path.join(BUILD_DIR, 'res', 'values', 'strings.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Lazy Terminal</string>
</resources>
`);

// 4. Write AndroidManifest.xml (API 21+ for universal device support, clean theme)
const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.lazyterm.app"
    android:versionCode="1"
    android:versionName="1.0.0">

    <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <application
        android:label="@string/app_name"
        android:icon="@drawable/icon"
        android:allowBackup="true"
        android:supportsRtl="true"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.Black.NoTitleBar">
        <activity
            android:name="com.lazyterm.app.MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;
fs.writeFileSync(path.join(BUILD_DIR, 'AndroidManifest.xml'), manifest);

// 5. Write MainActivity.java
const mainActivityJava = `package com.lazyterm.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.graphics.Color;
import android.view.KeyEvent;
import android.view.Window;
import android.view.WindowManager;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#07080a"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                return true;
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html?view=mobile&source=apk");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
`;
fs.writeFileSync(path.join(BUILD_DIR, 'src', 'com', 'lazyterm', 'app', 'MainActivity.java'), mainActivityJava);

// 6. Copy frontend built dist files to assets/www
console.log('2. Syncing frontend web assets into APK assets/www...');
const distDir = path.join(PROJECT_ROOT, 'dist');
if (fs.existsSync(distDir)) {
  fs.cpSync(distDir, path.join(BUILD_DIR, 'assets', 'www'), { recursive: true });
  // Avoid embedding downloads inside the APK itself
  const nestedDownloads = path.join(BUILD_DIR, 'assets', 'www', 'downloads');
  if (fs.existsSync(nestedDownloads)) {
    fs.rmSync(nestedDownloads, { recursive: true, force: true });
  }
}

// 7. Compile resources with AAPT2
console.log('3. Compiling resources with aapt2...');
const resZip = path.join(BUILD_DIR, 'compiled_res.zip');
execSync(`"${aapt2}" compile --dir "${path.join(BUILD_DIR, 'res')}" -o "${resZip}"`, { stdio: 'inherit' });

// 8. Link resources with AAPT2
console.log('4. Linking resources with aapt2...');
const unalignedApk = path.join(BUILD_DIR, 'unaligned.apk');
execSync(`"${aapt2}" link -I "${ANDROID_JAR}" --manifest "${path.join(BUILD_DIR, 'AndroidManifest.xml')}" -o "${unalignedApk}" "${resZip}" --java "${path.join(BUILD_DIR, 'src')}" --auto-add-overlay`, { stdio: 'inherit' });

// 9. Compile Java sources
console.log('5. Compiling Java sources with javac...');
const javaFiles = [
  path.join(BUILD_DIR, 'src', 'com', 'lazyterm', 'app', 'R.java'),
  path.join(BUILD_DIR, 'src', 'com', 'lazyterm', 'app', 'MainActivity.java')
].map(f => `"${f}"`).join(' ');

execSync(`"${javac}" -cp "${ANDROID_JAR}" -d "${path.join(BUILD_DIR, 'bin', 'classes')}" ${javaFiles}`, { stdio: 'inherit' });

// 10. Compile bytecode to Dalvik dex with d8
console.log('6. Compiling Dalvik bytecode with d8...');
const classesDir = path.join(BUILD_DIR, 'bin', 'classes');
const dexOutputDir = path.join(BUILD_DIR, 'bin', 'dex');

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(file));
    } else if (file.endsWith('.class')) {
      results.push(`"${file}"`);
    }
  });
  return results;
}
const classFiles = getAllFiles(classesDir).join(' ');

execSync(`"${d8}" --min-api 21 --lib "${ANDROID_JAR}" --output "${dexOutputDir}" ${classFiles}`, {
  env: { ...process.env, JAVA_HOME: 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot' },
  shell: true,
  stdio: 'inherit'
});

// 11. Add classes.dex and assets using Java jar tool with Unix forward slashes
console.log('7. Packaging classes.dex and assets with Unix forward slashes...');
const originalCwd = process.cwd();

// Add classes.dex
process.chdir(path.join(BUILD_DIR, 'bin', 'dex'));
execSync(`"${jar}" uf "${unalignedApk}" classes.dex`, { stdio: 'inherit' });

// Add assets/ directory
process.chdir(BUILD_DIR);
execSync(`"${jar}" uf "${unalignedApk}" assets`, { stdio: 'inherit' });

process.chdir(originalCwd);

// 12. Zipalign the package (4-byte alignment)
console.log('8. Aligning package with zipalign...');
const alignedApk = path.join(BUILD_DIR, 'aligned.apk');
execSync(`"${zipalign}" -f -p 4 "${unalignedApk}" "${alignedApk}"`, { stdio: 'inherit' });

// 13. Sign the APK with apksigner (v1, v2, v3 enabled, min-sdk 21)
console.log('9. Signing APK with apksigner (v1, v2, v3 schemes)...');
execSync(`"${apksigner}" sign --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --min-sdk-version 21 --ks "${KEYSTORE}" --ks-pass pass:android --key-pass pass:android --ks-key-alias androiddebugkey "${alignedApk}"`, {
  env: { ...process.env, JAVA_HOME: 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot' },
  shell: true,
  stdio: 'inherit'
});

// 14. Verify APK signature
console.log('10. Verifying APK signature...');
execSync(`"${apksigner}" verify --verbose "${alignedApk}"`, {
  env: { ...process.env, JAVA_HOME: 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot' },
  shell: true,
  stdio: 'inherit'
});

// 15. Copy output to public/downloads/LazyTerminal.apk
const targetApk = path.join(PROJECT_ROOT, 'public', 'downloads', 'LazyTerminal.apk');
const targetDebugApk = path.join(PROJECT_ROOT, 'public', 'downloads', 'lazy-terminal-debug.apk');
fs.copyFileSync(alignedApk, targetApk);
fs.copyFileSync(alignedApk, targetDebugApk);

// Also copy to dist/downloads if dist exists
const distApk = path.join(PROJECT_ROOT, 'dist', 'downloads', 'LazyTerminal.apk');
if (fs.existsSync(path.dirname(distApk))) {
  fs.copyFileSync(alignedApk, distApk);
  fs.copyFileSync(alignedApk, path.join(PROJECT_ROOT, 'dist', 'downloads', 'lazy-terminal-debug.apk'));
}

const stats = fs.statSync(targetApk);
console.log(`\nSUCCESS: Valid Android APK compiled and signed!`);
console.log(`Location: ${targetApk}`);
console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB (${stats.size} bytes)`);
