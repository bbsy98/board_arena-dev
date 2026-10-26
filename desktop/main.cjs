'use strict';

const { app, BrowserWindow, protocol } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

// Use a stable, secure custom origin so localStorage and Web Workers work
// consistently in the installed desktop app across app updates.
protocol.registerSchemesAsPrivileged([{
  scheme: 'hansu',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

const APP_ROOT = path.resolve(__dirname, '..');
// Stable profile path: account data survives application updates.
app.setPath('userData', path.join(app.getPath('appData'), 'HansuBoardArena'));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function isInsideRoot(candidate) {
  const relative = path.relative(APP_ROOT, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

async function registerAppProtocol() {
  await protocol.handle('hansu', async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'app') return new Response('Not found', { status: 404 });
      let pathname = decodeURIComponent(url.pathname || '/');
      if (pathname === '/') pathname = '/index.html';
      const filePath = path.resolve(APP_ROOT, '.' + pathname);
      if (!isInsideRoot(filePath)) return new Response('Forbidden', { status: 403 });
      const data = await fs.readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { status: 200, headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' } });
    } catch (error) {
      const status = error && error.code === 'ENOENT' ? 404 : 500;
      return new Response(status === 404 ? 'Not found' : 'App resource error', { status });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 360,
    minHeight: 600,
    title: '한수 - 오프라인 보드게임',
    icon: path.join(APP_ROOT, 'icons', 'icon-512.png'),
    autoHideMenuBar: true,
    backgroundColor: '#14161c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith('hansu://app/')) event.preventDefault();
  });
  win.loadURL('hansu://app/index.html');
  return win;
}

app.whenReady().then(async () => {
  await registerAppProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});