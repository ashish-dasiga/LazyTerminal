const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('lazyTerminalDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.0'
});
