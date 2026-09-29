const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('AD_ATLAS_DESKTOP', Object.freeze({
  enabled: true,
  platform: process.platform
}));
