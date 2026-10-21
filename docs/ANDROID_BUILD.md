# Android Build Instructions — Lazy Terminal

## Approach: Capacitor

The existing frontend is a React + Vite SPA. [Capacitor](https://capacitorjs.com/) wraps it in a native Android WebView with access to native APIs (filesystem, network, keyboard, back button).

### Why Capacitor
- Preserves the supplied frontend exactly (no framework change)
- Produces a real Android APK/AAB
- Access to native plugins for local storage, network info, secure storage
- No mandatory cost — fully open source
- Maintained by Ionic, widely adopted

### What Capacitor does NOT provide
- Native ConPTY terminal emulation — this runs on the Windows PC host
- Direct Windows IPC — communication goes over LAN HTTP/WS
- Code push / OTA updates without additional setup

## Prerequisites

1. **Node.js** ≥ 18
2. **Android Studio** (latest stable) with:
   - Android SDK Platform 34 (Android 14)
   - Android SDK Build-Tools 34
   - Android Emulator (optional, for testing)
3. **Java JDK** 17+ (bundled with Android Studio)
4. **Environment variables:**
   - `ANDROID_HOME` pointing to Android SDK location
   - Android SDK `platform-tools` and `build-tools` on `PATH`

## Setup (one-time)

```bash
# From the project root (C:\Users\nandi\LazyTerminal)

# 1. Install Capacitor dependencies
npm install @capacitor/core @capacitor/cli --save
npm install @capacitor/android --save

# 2. Initialize Capacitor (already done if capacitor.config.ts exists)
npx cap init "Lazy Terminal" "com.lazyterm.app" --web-dir dist

# 3. Build the frontend
npm run build

# 4. Add the Android platform
npx cap add android

# 5. Sync web assets into the Android project
npx cap sync android
```

## Build Debug APK

```bash
# 1. Build frontend
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Build debug APK via Gradle
cd android
./gradlew assembleDebug

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

## Install on device/emulator

```bash
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or open in Android Studio
npx cap open android
```

## Development loop

```bash
# Start Vite dev server
npm run dev

# In another terminal, run on device with live reload
npx cap run android --livereload --external
```

## Configuration

The Capacitor config is in `capacitor.config.ts` at the project root. Key settings:
- `appId`: `com.lazyterm.app`
- `appName`: `Lazy Terminal`
- `webDir`: `dist` (Vite build output)
- `server.androidScheme`: `https` (required for secure WebSocket connections)

## Known Limitations

1. **Android SDK required** — Cannot build APK without Android Studio / SDK installed
2. **No hot module replacement on device** — Use `cap run --livereload` for development
3. **WebView limitations** — Some advanced CSS/JS features may behave differently in Android WebView vs Chrome
4. **Network discovery** — The phone must be on the same LAN as the Windows PC host
5. **Secure storage** — Capacitor Preferences plugin stores data in SharedPreferences; for production, use `@capacitor/secure-storage` for tokens

## Troubleshooting

| Issue | Fix |
|---|---|
| `ANDROID_HOME not set` | Set env variable to Android SDK path |
| `gradle command not found` | Use `./gradlew` (Unix) or `gradlew.bat` (Windows) from `android/` dir |
| `SDK platform not installed` | Open Android Studio SDK Manager, install Platform 34 |
| `WebView blank screen` | Check that `npm run build` succeeded and `dist/` has files |
| `Cannot connect to PC` | Verify both devices on same LAN, PC firewall allows port 9871 |
