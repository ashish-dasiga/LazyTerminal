const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 1. Single-Instance Application Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[LazyTerminal Desktop] Another instance is already running. Exiting redundant process.');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let runningServer = null;

// Handle second-instance attempt: restore and focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

async function startBackendAndCreateWindow() {
  const iconCandidates = [
    path.join(__dirname, '..', 'public', 'downloads', 'app_icon.ico'),
    path.join(__dirname, 'app_icon.ico'),
    path.join(__dirname, '..', 'icon.jpeg'),
    path.join(process.resourcesPath || '', 'app', 'public', 'downloads', 'app_icon.ico'),
  ];
  const resolvedIcon = iconCandidates.find((p) => fs.existsSync(p));

  // 2. Start internal Host Companion Server
  let companionPort = parseInt(process.env.LAZY_TERMINAL_HOST_PORT || '9871', 10);
  try {
    let companionServerModule;
    const candidatePaths = [
      path.join(__dirname, 'companionServer.cjs'),
      path.join(__dirname, '..', 'dist-electron', 'companionServer.cjs'),
      path.join(__dirname, '..', 'dist', 'companionServer.cjs'),
      path.join(process.resourcesPath || '', 'app', 'companionServer.cjs'),
      path.join(process.resourcesPath || '', 'companionServer.cjs'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        companionServerModule = require(p);
        break;
      }
    }

    if (companionServerModule && typeof companionServerModule.startHostCompanionServer === 'function') {
      runningServer = await companionServerModule.startHostCompanionServer({
        hostBind: '0.0.0.0',
        hostPort: companionPort,
        defaultWorkspaceRoot: process.cwd(),
      });
      companionPort = runningServer.port;
      console.log(`[LazyTerminal Desktop] Internal companion server started on port ${companionPort}`);
    } else {
      console.warn('[LazyTerminal Desktop] Companion server module not found, continuing with port', companionPort);
    }
  } catch (err) {
    console.error('[LazyTerminal Desktop] Failed to start companion server:', err);
  }

  // 3. Create the Main Application Window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Lazy Terminal',
    icon: resolvedIcon,
    backgroundColor: '#07080a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const appUrl = `http://127.0.0.1:${companionPort}/?view=laptop`;
  console.log(`[LazyTerminal Desktop] Loading main application UI: ${appUrl}`);

  mainWindow.loadURL(appUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(startBackendAndCreateWindow);

app.on('window-all-closed', async () => {
  if (runningServer && typeof runningServer.close === 'function') {
    try {
      await runningServer.close();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startBackendAndCreateWindow();
  }
});
