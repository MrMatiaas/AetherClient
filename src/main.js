// src/main.js - Proceso principal de Electron
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Client, Authenticator } = require('minecraft-launcher-core');
const fs = require('fs-extra');
const crypto = require('crypto');

let mainWindow;
let minecraftProcess = null;

// Crear ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    frame: true,
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Abrir DevTools para ver errores y logs
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ==================== FUNCIONES DEL LAUNCHER ====================

// Generar UUID offline basado en el nombre de usuario
function generateOfflineUUID(username) {
  // Genera un UUID versión 3 (basado en nombre) para modo offline
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest('hex');
  
  // Formatear como UUID
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

// Obtener ruta del directorio de Minecraft (usa la carpeta estándar .minecraft)
function getMinecraftPath() {
  const homedir = require('os').homedir();
  switch (process.platform) {
    case 'win32':
      // Windows: C:\Users\TuUsuario\AppData\Roaming\.minecraft
      return path.join(homedir, 'AppData', 'Roaming', '.minecraft');
    case 'darwin':
      // macOS: /Users/TuUsuario/Library/Application Support/minecraft
      return path.join(homedir, 'Library', 'Application Support', 'minecraft');
    case 'linux':
      // Linux: /home/tuusuario/.minecraft
      return path.join(homedir, '.minecraft');
    default:
      return path.join(homedir, '.minecraft');
  }
}

// Lanzar Minecraft (MODO OFFLINE) - CON SOPORTE PARA FORGE
ipcMain.handle('launch-minecraft', async (event, config) => {
  const { username, version, memory } = config;
  
  try {
    // Enviar log al renderer
    const sendLog = (message) => {
      mainWindow.webContents.send('game-log', message);
    };

    sendLog('🎮 Iniciando Minecraft en modo OFFLINE...');
    sendLog(`Usuario: ${username}`);
    sendLog(`Versión: ${version}`);
    sendLog(`Memoria: ${memory}MB`);

    const minecraftPath = getMinecraftPath();
    await fs.ensureDir(minecraftPath);

    sendLog(`📁 Directorio: ${minecraftPath}`);

    // Detectar si es Forge o versión modificada
    const isForge = version.toLowerCase().includes('forge');
    const isFabric = version.toLowerCase().includes('fabric');
    const isOptifine = version.toLowerCase().includes('optifine');
    
    if (isForge) {
      sendLog(`🔨 Versión Forge detectada`);
    } else if (isFabric) {
      sendLog(`🧵 Versión Fabric detectada`);
    } else if (isOptifine) {
      sendLog(`⚡ Versión Optifine detectada`);
    }

    // Crear cliente del launcher
    const launcher = new Client();

    // Configuración para modo OFFLINE
    const opts = {
      authorization: {
        access_token: null,
        client_token: null,
        uuid: generateOfflineUUID(username),
        name: username,
        user_properties: JSON.stringify({})
      },
      root: minecraftPath,
      version: {
        number: version,
        type: isForge || isFabric || isOptifine ? "custom" : "release",
        custom: version
      },
      memory: {
        max: `${memory}M`,
        min: "512M"
      },
      forge: isForge ? version : undefined,
      customLaunchArgs: [],
      overrides: {
        detached: false
      }
    };

    sendLog('📥 Verificando archivos del juego...');

    // Eventos del launcher
    launcher.on('debug', (e) => sendLog(`[DEBUG] ${e}`));
    launcher.on('data', (e) => sendLog(`[GAME] ${e.toString().trim()}`));
    launcher.on('progress', (e) => {
      sendLog(`📊 ${e.type}: ${e.task} ${e.total ? `(${e.current}/${e.total})` : ''}`);
      mainWindow.webContents.send('download-progress', {
        type: e.type,
        task: e.task,
        total: e.total,
        current: e.current
      });
    });

    launcher.on('close', (code) => {
      sendLog(`✓ Minecraft cerrado (código: ${code})`);
      mainWindow.webContents.send('game-closed', code);
      minecraftProcess = null;
    });

    // Lanzar el juego
    sendLog('🚀 Lanzando Minecraft...');
    minecraftProcess = await launcher.launch(opts);

    sendLog('✅ ¡Minecraft iniciado correctamente!');
    mainWindow.webContents.send('game-started');

    return { success: true };

  } catch (error) {
    console.error('Error al lanzar Minecraft:', error);
    mainWindow.webContents.send('game-log', `❌ ERROR: ${error.message}`);
    mainWindow.webContents.send('game-log', `💡 Si es una versión modificada, asegúrate de instalarla primero con su instalador oficial`);
    mainWindow.webContents.send('game-closed', 1);
    return { success: false, error: error.message };
  }
});

// Detener Minecraft
ipcMain.handle('stop-minecraft', async () => {
  if (minecraftProcess) {
    minecraftProcess.kill();
    minecraftProcess = null;
    return { success: true };
  }
  return { success: false };
});

// Obtener versiones disponibles desde Mojang
ipcMain.handle('get-versions', async () => {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const data = await response.json();
    
    // Filtrar solo releases (no snapshots)
    const releases = data.versions
      .filter(v => v.type === 'release')
      .slice(0, 30) // Últimas 30 versiones
      .map(v => ({
        id: v.id,
        type: 'release',
        releaseTime: v.releaseTime
      }));
    
    return { success: true, versions: releases };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Detectar versiones instaladas en .minecraft
ipcMain.handle('get-installed-versions', async () => {
  try {
    const minecraftPath = getMinecraftPath();
    const versionsPath = path.join(minecraftPath, 'versions');
    
    if (!await fs.pathExists(versionsPath)) {
      return { success: true, vanilla: [], forge: [], fabric: [], optifine: [] };
    }
    
    const folders = await fs.readdir(versionsPath);
    const vanillaVersions = [];
    const forgeVersions = [];
    const fabricVersions = [];
    const optifineVersions = [];
    
    for (const folder of folders) {
      const versionJsonPath = path.join(versionsPath, folder, `${folder}.json`);
      if (await fs.pathExists(versionJsonPath)) {
        const folderLower = folder.toLowerCase();
        
        if (folderLower.includes('forge')) {
          forgeVersions.push(folder);
        } else if (folderLower.includes('fabric')) {
          fabricVersions.push(folder);
        } else if (folderLower.includes('optifine')) {
          optifineVersions.push(folder);
        } else {
          vanillaVersions.push(folder);
        }
      }
    }
    
    return { 
      success: true, 
      vanilla: vanillaVersions.sort().reverse(),
      forge: forgeVersions.sort().reverse(),
      fabric: fabricVersions.sort().reverse(),
      optifine: optifineVersions.sort().reverse()
    };
  } catch (error) {
    return { success: false, error: error.message, vanilla: [], forge: [], fabric: [], optifine: [] };
  }
});

// Verificar si existe la carpeta .minecraft
ipcMain.handle('check-minecraft-folder', async () => {
  const minecraftPath = getMinecraftPath();
  const exists = await fs.pathExists(minecraftPath);
  
  if (exists) {
    // Verificar qué tiene instalado
    const hasVersions = await fs.pathExists(path.join(minecraftPath, 'versions'));
    const hasAssets = await fs.pathExists(path.join(minecraftPath, 'assets'));
    const hasLibraries = await fs.pathExists(path.join(minecraftPath, 'libraries'));
    
    return {
      exists: true,
      path: minecraftPath,
      hasVersions,
      hasAssets,
      hasLibraries,
      isComplete: hasVersions && hasAssets && hasLibraries
    };
  }
  
  return { exists: false, path: minecraftPath };
});

// Verificar Java instalado
ipcMain.handle('check-java', async () => {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec('java -version', (error, stdout, stderr) => {
      if (error) {
        resolve({ installed: false });
      } else {
        const version = stderr.match(/version "(.+?)"/)?.[1] || 'desconocida';
        resolve({ installed: true, version });
      }
    });
  });
});

// Obtener configuración guardada
ipcMain.handle('get-config', async () => {
  const configPath = path.join(app.getPath('userData'), 'launcher-config.json');
  try {
    if (await fs.pathExists(configPath)) {
      const config = await fs.readJson(configPath);
      return config;
    }
  } catch (error) {
    console.error('Error al leer configuración:', error);
  }
  
  // Configuración por defecto - USA LA CARPETA .minecraft ESTÁNDAR
  return {
    username: 'Player',
    version: '1.20.1',
    memory: 2048,
    minecraftPath: getMinecraftPath() // Usa .minecraft estándar
  };
});

// Guardar configuración
ipcMain.handle('save-config', async (event, config) => {
  const configPath = path.join(app.getPath('userData'), 'launcher-config.json');
  try {
    await fs.writeJson(configPath, config, { spaces: 2 });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});