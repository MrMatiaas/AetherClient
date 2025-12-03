// src/preload.js - Expone funciones seguras al renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  launch: (config) => ipcRenderer.invoke('launch-minecraft', config),
  stop: () => ipcRenderer.invoke('stop-minecraft'),
  getVersions: () => ipcRenderer.invoke('get-versions'),
  getInstalledVersions: () => ipcRenderer.invoke('get-installed-versions'),
  checkMinecraftFolder: () => ipcRenderer.invoke('check-minecraft-folder'),
  checkJava: () => ipcRenderer.invoke('check-java'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  onGameLog: (callback) => {
    ipcRenderer.on('game-log', (event, message) => callback(message));
  },
  onGameStarted: (callback) => {
    ipcRenderer.on('game-started', () => callback());
  },
  onGameClosed: (callback) => {
    ipcRenderer.on('game-closed', (event, code) => callback(code));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  }
});