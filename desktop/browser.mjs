import { session, WebContentsView } from 'electron';
import { isIcyRotationUrl } from '../lib/browser.mjs';

const restricted = new WeakSet();

export function restrictSession(browserSession) {
  if (restricted.has(browserSession)) return;
  restricted.add(browserSession);
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.on('will-download', event => event.preventDefault());
}

export async function launchBundledGuideBrowser(profile) {
  const browserSession = session.fromPath(profile, { cache: false });
  restrictSession(browserSession);
  const targets = new Map();
  const listeners = new Set();
  let nextId = 0;
  let closed = false;
  const close = () => {
    closed = true;
    for (const view of targets.values()) if (!view.webContents.isDestroyed()) view.webContents.close();
    targets.clear();
    listeners.clear();
  };
  return {
    mode: 'bundled-browser',
    listen(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async send(method, params = {}, sessionId) {
      if (closed) throw new Error('Guide browser disconnected.');
      if (method === 'Target.createTarget') {
        const targetId = String(++nextId);
        const view = new WebContentsView({ webPreferences: {
          session: browserSession, sandbox: true, contextIsolation: true, nodeIntegration: false,
          backgroundThrottling: false, spellcheck: false,
        } });
        const contents = view.webContents;
        contents.setWindowOpenHandler(() => ({ action: 'deny' }));
        for (const event of ['will-navigate', 'will-redirect']) contents.on(event, (event, url) => {
          if (!isIcyRotationUrl(url)) event.preventDefault();
        });
        await contents.loadURL('about:blank');
        contents.debugger.attach('1.3');
        contents.debugger.on('message', (_event, method, params) => {
          for (const listener of listeners) listener({ method, params, sessionId: targetId });
        });
        targets.set(targetId, view);
        return { targetId };
      }
      if (method === 'Target.attachToTarget') {
        if (!targets.has(params.targetId)) throw new Error('Unknown guide target.');
        return { sessionId: params.targetId };
      }
      if (method === 'Target.closeTarget') {
        const view = targets.get(params.targetId);
        if (view && !view.webContents.isDestroyed()) view.webContents.close();
        targets.delete(params.targetId);
        return {};
      }
      if (method === 'Browser.close') { close(); return {}; }
      const view = targets.get(sessionId);
      if (!view || view.webContents.isDestroyed()) throw new Error('Guide browser disconnected.');
      if (method === 'Page.navigate' && !isIcyRotationUrl(params.url)) throw new Error('Unexpected guide URL.');
      return view.webContents.debugger.sendCommand(method, params);
    },
    close,
  };
}
