// src/renderer/app.js - Lógica del frontend
let isGameRunning = false;
let currentConfig = {};

// Elementos del DOM
const playBtn = document.getElementById('play-btn');
const playText = document.getElementById('play-text');
const username = document.getElementById('username');
const version = document.getElementById('version');
const memory = document.getElementById('memory');
const memoryValue = document.getElementById('memory-value');
const consoleLogs = document.getElementById('console-logs');
const clearLogs = document.getElementById('clear-logs');
const versionDisplay = document.getElementById('version-display');
const refreshVersions = document.getElementById('refresh-versions');
const javaStatus = document.getElementById('java-status');
const minecraftPath = document.getElementById('minecraft-path');
const versionStatus = document.getElementById('version-status');
const downloadProgress = document.getElementById('download-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const progressPercent = document.getElementById('progress-percent');

// Cargar configuración al iniciar
async function init() {
  addLog('🚀 Inicializando launcher...', 'info');
  
  try {
    // Cargar configuración guardada
    const config = await window.launcher.getConfig();
    currentConfig = config;
    
    username.value = config.username || 'Player';
    memory.value = config.memory || 2048;
    updateMemoryDisplay();
    
    addLog('✅ Configuración cargada', 'success');
    
    // Verificar carpeta .minecraft
    addLog('📁 Verificando carpeta .minecraft...', 'info');
    await checkMinecraftFolder();
    
    // Cargar versiones instaladas primero
    addLog('🔍 Buscando versiones instaladas...', 'info');
    await loadInstalledVersions();
    
    // Establecer versión guardada o la primera disponible
    if (config.version && version.querySelector(`option[value="${config.version}"]`)) {
      version.value = config.version;
    } else if (version.options.length > 0) {
      version.value = version.options[0].value;
    }
    updateVersionDisplay();
    
    // Verificar Java
    addLog('☕ Verificando Java...', 'info');
    await checkJavaInstallation();
    
    addLog('✅ Launcher listo para usar', 'success');
  } catch (error) {
    addLog(`❌ Error durante inicialización: ${error.message}`, 'error');
    console.error('Error en init:', error);
  }
}

// Verificar carpeta .minecraft
async function checkMinecraftFolder() {
  try {
    const result = await window.launcher.checkMinecraftFolder();
    
    if (result.exists) {
      let statusHTML = `
        <div class="status-success">
          ✅ Carpeta .minecraft encontrada<br>
          <small style="word-break: break-all; font-size: 0.75em;">${result.path}</small>
      `;
      
      if (result.isComplete) {
        statusHTML += '<br><small>✓ Instalación completa detectada</small>';
        addLog(`✅ Carpeta .minecraft completa: ${result.path}`, 'success');
      } else {
        statusHTML += '<br><small>⚠️ Archivos faltantes se descargarán</small>';
        addLog(`⚠️ Carpeta .minecraft incompleta`, 'info');
      }
      
      statusHTML += '</div>';
      minecraftPath.innerHTML = statusHTML;
    } else {
      minecraftPath.innerHTML = `
        <div class="status-info">
          📁 Se creará carpeta .minecraft<br>
          <small style="word-break: break-all; font-size: 0.75em;">${result.path}</small>
        </div>
      `;
      addLog(`📁 Se creará .minecraft en: ${result.path}`, 'info');
    }
  } catch (error) {
    addLog(`❌ Error verificando carpeta: ${error.message}`, 'error');
    minecraftPath.innerHTML = `
      <div class="status-error">
        ❌ Error al verificar carpeta<br>
        <small>${error.message}</small>
      </div>
    `;
  }
}

// Cargar versiones instaladas localmente
async function loadInstalledVersions() {
  try {
    versionStatus.textContent = 'Buscando versiones instaladas...';
    
    const result = await window.launcher.getInstalledVersions();
    
    version.innerHTML = '';
    
    let hasVersions = false;
    
    if (result.success && result.versions && result.versions.length > 0) {
      // Agregar versiones vanilla instaladas
      result.versions.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = `${v} ✓`;
        version.appendChild(option);
      });
      hasVersions = true;
      
      versionStatus.innerHTML = `<span style="color: #51cf66;">✅ ${result.versions.length} vanilla instalada(s)</span>`;
      addLog(`✅ ${result.versions.length} versión(es) vanilla encontrada(s)`, 'success');
    }
    
    // Informar sobre versiones modificadas si existen
    if (result.modded && result.modded.length > 0) {
      addLog(`ℹ️ ${result.modded.length} versión(es) modificada(s) detectada(s):`, 'info');
      result.modded.forEach(v => {
        addLog(`   • ${v} (no soportado directamente)`, 'info');
      });
      addLog(`💡 Para jugar con mods, usa el launcher oficial primero`, 'info');
    }
    
    if (!hasVersions) {
      // Si no hay versiones instaladas, agregar versiones populares por defecto
      const defaultVersions = ['1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'];
      defaultVersions.forEach(v => {
        const option = document.createElement('option');
        option.value = v;
        option.textContent = v;
        version.appendChild(option);
      });
      
      versionStatus.innerHTML = '<span style="color: #ffc107;">⚠️ Sin versiones instaladas</span>';
      addLog('ℹ️ No hay versiones instaladas. Se descargarán al jugar.', 'info');
    }
  } catch (error) {
    addLog(`❌ Error cargando versiones: ${error.message}`, 'error');
    versionStatus.innerHTML = '<span style="color: #ff6b6b;">❌ Error</span>';
    
    // Cargar versiones por defecto como fallback
    const defaultVersions = ['1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2'];
    version.innerHTML = '';
    defaultVersions.forEach(v => {
      const option = document.createElement('option');
      option.value = v;
      option.textContent = v;
      version.appendChild(option);
    });
  }
}

// Agregar log a la consola
function addLog(message, type = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleLogs.appendChild(logEntry);
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// Limpiar logs
clearLogs.addEventListener('click', () => {
  consoleLogs.innerHTML = '<div class="log-entry">📋 Logs limpiados</div>';
});

// Actualizar display de memoria
function updateMemoryDisplay() {
  const mb = parseInt(memory.value);
  const gb = (mb / 1024).toFixed(1);
  memoryValue.textContent = `${mb} MB (${gb} GB)`;
}

memory.addEventListener('input', updateMemoryDisplay);

// Actualizar display de versión
function updateVersionDisplay() {
  versionDisplay.textContent = `Minecraft ${version.value}`;
}

version.addEventListener('change', updateVersionDisplay);

// Verificar Java
async function checkJavaInstallation() {
  javaStatus.innerHTML = '<div class="status-loading">⏳ Verificando Java...</div>';
  
  const result = await window.launcher.checkJava();
  
  if (result.installed) {
    javaStatus.innerHTML = `
      <div class="status-success">
        ✅ Java instalado<br>
        <small>Versión: ${result.version}</small>
      </div>
    `;
    addLog(`✅ Java detectado: ${result.version}`, 'success');
  } else {
    javaStatus.innerHTML = `
      <div class="status-error">
        ❌ Java no detectado<br>
        <small>Instala Java 17+ para jugar</small>
      </div>
    `;
    addLog('❌ Java no encontrado. Por favor instálalo.', 'error');
  }
}

// Refrescar versiones disponibles (desde internet)
refreshVersions.addEventListener('click', async () => {
  addLog('🔄 Obteniendo lista de versiones desde Mojang...');
  refreshVersions.disabled = true;
  refreshVersions.textContent = '⏳ Cargando...';
  versionStatus.textContent = 'Descargando lista...';
  
  const result = await window.launcher.getVersions();
  
  if (result.success) {
    version.innerHTML = '';
    result.versions.forEach(v => {
      const option = document.createElement('option');
      option.value = v;
      option.textContent = v;
      version.appendChild(option);
    });
    versionStatus.innerHTML = `<span style="color: #51cf66;">✅ ${result.versions.length} versiones disponibles</span>`;
    addLog(`✅ ${result.versions.length} versiones cargadas desde internet`, 'success');
  } else {
    addLog(`❌ Error al cargar versiones: ${result.error}`, 'error');
    versionStatus.innerHTML = '<span style="color: #ff6b6b;">❌ Error al cargar</span>';
    
    // Volver a cargar versiones instaladas si falla
    await loadInstalledVersions();
  }
  
  refreshVersions.disabled = false;
  refreshVersions.textContent = '🔄 Actualizar versiones';
});

// Guardar configuración
async function saveConfig() {
  const config = {
    username: username.value,
    version: version.value,
    memory: parseInt(memory.value)
  };
  
  await window.launcher.saveConfig(config);
  currentConfig = config;
}

// Lanzar Minecraft
playBtn.addEventListener('click', async () => {
  if (isGameRunning) {
    // Detener el juego
    addLog('🛑 Deteniendo Minecraft...');
    await window.launcher.stop();
    return;
  }
  
  // Validar nombre de usuario
  if (!username.value || username.value.trim() === '') {
    addLog('❌ Por favor ingresa un nombre de usuario', 'error');
    username.focus();
    return;
  }
  
  // Guardar configuración
  await saveConfig();
  
  // Preparar lanzamiento
  playBtn.disabled = true;
  playText.textContent = 'LANZANDO...';
  addLog('='.repeat(50));
  addLog('🎮 INICIANDO MINECRAFT - MODO OFFLINE', 'info');
  addLog('='.repeat(50));
  
  const config = {
    username: username.value,
    version: version.value,
    memory: parseInt(memory.value)
  };
  
  // Lanzar el juego
  const result = await window.launcher.launch(config);
  
  if (!result.success) {
    addLog(`❌ Error al lanzar: ${result.error}`, 'error');
    playBtn.disabled = false;
    playText.textContent = 'JUGAR';
  }
});

// Escuchar eventos del launcher
window.launcher.onGameLog((message) => {
  const type = message.includes('ERROR') || message.includes('❌') ? 'error' 
             : message.includes('✅') || message.includes('✓') ? 'success' 
             : 'info';
  addLog(message, type);
});

window.launcher.onGameStarted(() => {
  isGameRunning = true;
  playBtn.disabled = false;
  playText.textContent = 'DETENER';
  playBtn.style.background = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
  addLog('🎉 ¡Minecraft iniciado! Diviértete jugando.', 'success');
});

window.launcher.onGameClosed((code) => {
  isGameRunning = false;
  playBtn.disabled = false;
  playText.textContent = 'JUGAR';
  playBtn.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
  downloadProgress.classList.add('hidden');
  addLog(`👋 Minecraft cerrado (código: ${code})`, 'info');
});

window.launcher.onDownloadProgress((data) => {
  if (data.type === 'download' || data.type === 'extract') {
    downloadProgress.classList.remove('hidden');
    
    if (data.total && data.current) {
      const percent = Math.round((data.current / data.total) * 100);
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressText.textContent = `${data.type}: ${data.task}`;
    } else {
      progressText.textContent = `${data.type}: ${data.task}`;
    }
  }
});

// Inicializar al cargar
init();