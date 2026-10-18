import { app, BrowserWindow, dialog, Menu, net, protocol, screen, session, shell } from 'electron';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBundledGuideBrowser, restrictSession } from './browser.mjs';
import { startServer } from '../server.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const home = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : root);
const directory = path.resolve(process.env.EORZEA_DATA_DIR || path.join(home, 'Eorzea Rotation Library Data'));
let window;
let runtime;
const workers = new Set();

try {
  for (const folder of ['', 'profile', 'browser', 'logs', 'crashes']) mkdirSync(path.join(directory, folder), { recursive: true });
  app.setPath('userData', path.join(directory, 'profile'));
  app.setPath('sessionData', path.join(directory, 'browser'));
  app.setPath('crashDumps', path.join(directory, 'crashes'));
  app.setAppLogsPath(path.join(directory, 'logs'));
} catch (error) {
  dialog.showErrorBox('Eorzea Rotation Library', `Move the EXE to a writable folder and try again.\n\n${error.message}`);
  app.exit(1);
}
protocol.registerSchemesAsPrivileged([{ scheme: 'eorzea', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setAppUserModelId('Eorzea.RotationLibrary.Portable');
app.enableSandbox();

const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    for (const worker of workers) worker.close();
    runtime?.close();
    session.defaultSession?.flushStorageData();
  });
  app.whenReady().then(open).catch(error => {
    writeFileSync(path.join(directory, 'logs/startup-error.log'), `${new Date().toISOString()} ${error.stack}\n`);
    dialog.showErrorBox('Eorzea Rotation Library could not open', error.message);
    app.exit(1);
  });
}

function external(url) {
  try {
    const value = new URL(url);
    return value.protocol === 'https:' && !value.username && !value.password &&
      ['na.finalfantasyxiv.com', 'www.thebalanceffxiv.com', 'www.icy-veins.com', 'v2.xivapi.com', 'game-icons.net', 'creativecommons.org'].includes(value.hostname);
  } catch { return false; }
}

async function open() {
  restrictSession(session.defaultSession);
  runtime = await startServer({ directory, port: 0, launchBrowser: async profile => {
    const worker = await launchBundledGuideBrowser(profile);
    workers.add(worker);
    const close = worker.close;
    worker.close = () => { workers.delete(worker); close(); };
    return worker;
  } });
  protocol.handle('eorzea', async request => {
    const url = new URL(request.url);
    if (url.hostname !== 'library' || url.username || url.password || url.port || !['GET', 'HEAD', 'POST'].includes(request.method))
      return new Response('Not found', { status: 404 });
    const headers = new Headers();
    if (request.headers.get('origin') && request.headers.get('origin') !== 'eorzea://library') return new Response('Forbidden', { status: 403 });
    if (request.headers.get('x-eorzea-client')) headers.set('x-eorzea-client', request.headers.get('x-eorzea-client'));
    if (request.method === 'POST') headers.set('origin', runtime.origin);
    return net.fetch(`${runtime.origin}${url.pathname}${url.search}`, { method: request.method, headers, redirect: 'error' });
  });
  let saved;
  try { saved = JSON.parse(readFileSync(path.join(directory, 'window.json'), 'utf8')); } catch {}
  const bounds = saved?.bounds;
  const valid = bounds && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) &&
    bounds.width >= 640 && bounds.height >= 480 && screen.getAllDisplays().some(({ workArea }) =>
      bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x &&
      bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y);
  window = new BrowserWindow({
    ...(valid ? bounds : { width: 1280, height: 900 }), minWidth: 640, minHeight: 480,
    show: false, title: 'Eorzea Rotation Library', backgroundColor: '#1b1d1f',
    icon: path.join(root, 'public/crystal.png'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
  });
  if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE) {
    const icon = readFileSync(path.join(root, 'public/crystal.ico'));
    const iconHash = createHash('sha256').update(icon).digest('hex').slice(0, 16);
    // A new resource path keeps Windows from reusing an outdated taskbar icon.
    const iconPath = path.join(directory, 'profile', `app-icon-${iconHash}.ico`);
    writeFileSync(iconPath, icon);
    window.setAppDetails({
      appId: 'Eorzea.RotationLibrary.Portable', appIconPath: iconPath, appIconIndex: 0,
      relaunchCommand: `"${process.env.PORTABLE_EXECUTABLE_FILE}"`, relaunchDisplayName: 'Eorzea Rotation Library',
    });
  }
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  for (const event of ['will-navigate', 'will-redirect']) window.webContents.on(event, (event, url) => {
    const destination = new URL(url);
    if (destination.protocol !== 'eorzea:' || destination.hostname !== 'library') event.preventDefault();
  });
  window.on('close', () => {
    writeFileSync(path.join(directory, 'window.json'), JSON.stringify({ bounds: window.getNormalBounds(), maximized: window.isMaximized() }));
  });
  if (saved?.maximized !== false) window.maximize();
  await window.loadURL('eorzea://library/');
  window.show();
}
