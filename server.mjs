import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CHECK_INTERVAL, readLibrary, refreshLibrary, assetMap, createAssetLoader } from './lib/sources.mjs';
import { createBrowserGuideReader } from './lib/browser.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export async function startServer({ directory = process.env.EORZEA_DATA_DIR || path.join(root, 'data'), port = Number(process.env.EORZEA_PORT || 47823), autoUpdate = true, launchBrowser } = {}) {
  let origin;
  let library = await readLibrary(directory);
  let assets = assetMap(library);
  const images = createAssetLoader(directory);
  const warmIcons = job => images.prefetch([...assetMap({ jobs: [job] })].filter(([key]) => !key.startsWith('guide-')));
  let refreshing;
  let progress = null;
  let lastError = null;

  function refresh() {
    if (refreshing) return refreshing;
    progress = { completed: 0, total: 23, job: 'Starting' };
    lastError = null;
    refreshing = refreshLibrary(directory, library, { onActions: warmIcons, onProgress: value => { progress = value; }, ...(launchBrowser ? { browserReader: createBrowserGuideReader(directory, { launch: launchBrowser, notBefore: library.icyVeins?.browserRefresh?.retryAt }) } : {}) })
      .then(result => { library = result; assets = assetMap(library); console.log(`Updated ${library.jobs.length} jobs at ${library.checkedAt}`); })
      .catch(error => { lastError = error.message; console.error('Update failed:', error.message); })
      .finally(() => { refreshing = null; progress = null; });
    return refreshing;
  }

  const staticFiles = new Map([
    ['/', ['public/index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
    ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
    ['/manifest.webmanifest', ['public/manifest.webmanifest', 'application/manifest+json']],
    ['/favicon.ico', ['public/crystal.ico', 'image/vnd.microsoft.icon']],
    ['/aetheryte.ico', ['public/crystal.ico', 'image/vnd.microsoft.icon']],
    ['/aetheryte.png', ['public/crystal.png', 'image/png']],
    ['/crystal-hd.ico', ['public/crystal.ico', 'image/vnd.microsoft.icon']],
    ['/crystal-hd.png', ['public/crystal.png', 'image/png']],
    ['/aetheryte-crystal.ico', ['public/crystal.ico', 'image/vnd.microsoft.icon']],
    ['/aetheryte-crystal.png', ['public/crystal.png', 'image/png']],
    ['/aetheryte-crystal.svg', ['public/crystal.svg', 'image/svg+xml']],
    ['/crystal.ico', ['public/crystal.ico', 'image/vnd.microsoft.icon']],
    ['/crystal.png', ['public/crystal.png', 'image/png']],
    ['/crystal.svg', ['public/crystal.svg', 'image/svg+xml']],
    ['/modules/catalog.mjs', ['lib/catalog.mjs', 'text/javascript; charset=utf-8']],
    ['/modules/rotations.mjs', ['lib/rotations.mjs', 'text/javascript; charset=utf-8']],
    ['/modules/entry.mjs', ['lib/entry.mjs', 'text/javascript; charset=utf-8']],
    ['/modules/planner.mjs', ['lib/planner.mjs', 'text/javascript; charset=utf-8']],
    ['/modules/prerequisites.mjs', ['lib/prerequisites.mjs', 'text/javascript; charset=utf-8']],
    ['/modules/updates.mjs', ['lib/updates.mjs', 'text/javascript; charset=utf-8']],
    ['/modules/presentation.mjs', ['lib/presentation.mjs', 'text/javascript; charset=utf-8']],
  ]);

  function json(response, status, value) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
  }

  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    try {
      if (![ `127.0.0.1:${server.address().port}`, `localhost:${server.address().port}` ].includes(request.headers.host)) return json(response, 403, { error: 'Loopback requests only' });
      const url = new URL(request.url, origin);
      if (request.method === 'POST') {
        if (request.headers.origin && ![origin, `http://localhost:${server.address().port}`].includes(request.headers.origin)) return json(response, 403, { error: 'Origin not allowed' });
        if (request.headers['x-eorzea-client'] !== 'library') return json(response, 403, { error: 'Missing local client header' });
        if (url.pathname !== '/api/sync') return json(response, 404, { error: 'Not found' });
        refresh();
        return json(response, 202, { updating: true });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed' });
      if (url.pathname === '/api/library') return json(response, 200, { ...library, updating: Boolean(refreshing), progress, error: lastError });
      if (url.pathname === '/api/status') return json(response, 200, { application: 'Eorzea Rotation Library', updating: Boolean(refreshing), checkedAt: library.checkedAt, progress, error: lastError });
      const image = url.pathname.match(/^\/api\/icons\/([A-Za-z0-9_-]+)\.png$/);
      if (image) {
        const entry = assets.get(image[1]);
        if (!entry) return json(response, 404, { error: 'Image not found' });
        const { bytes, stale } = await images.get(image[1], entry);
        let type = 'image/png';
        if (bytes[0] === 0xff && bytes[1] === 0xd8) type = 'image/jpeg';
        else if (bytes.subarray(8, 12).toString() === 'WEBP') type = 'image/webp';
        response.writeHead(200, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'private, max-age=21600', 'X-Eorzea-Cached': stale ? 'stale' : 'current' });
        response.end(request.method === 'HEAD' ? undefined : bytes);
        return;
      }
      const resource = staticFiles.get(url.pathname);
      if (!resource) return json(response, 404, { error: 'Not found' });
      const bytes = await readFile(path.join(root, resource[0]));
      response.writeHead(200, { 'Content-Type': resource[1], 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (!response.headersSent) json(response, 502, { error: error.message });
      else response.end();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  console.log(`Eorzea Rotation Library: ${origin}`);
  images.prefetch([...assets].filter(([key]) => !key.startsWith('guide-')));
  if (autoUpdate && (!library.checkedAt || Date.now() - Date.parse(library.checkedAt) >= CHECK_INTERVAL)) refresh();
  const timer = autoUpdate ? setInterval(() => refresh(), CHECK_INTERVAL) : null;
  timer?.unref();
  return { origin, close: async () => {
    clearInterval(timer);
    server.closeAllConnections();
    const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await images.close();
    await closed;
  } };
}

