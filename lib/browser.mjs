import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export function isIcyRotationUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.icy-veins.com' && !url.username && !url.password && !url.search && !url.hash &&
      /^\/ffxiv\/[a-z-]+(?:-rotation-openers-abilities|-dps-rotation-for-healers)$/.test(url.pathname);
  } catch { return false; }
}

export function createBrowserGuideReader(directory, { launch = async () => { throw new Error('Guide refresh requires the desktop app.'); }, pause = delay, timeout = 20000, notBefore = 0 } = {}) {
  let queue = Promise.resolve();
  let browser;
  let unavailable;
  let retryAt = typeof notBefore === 'number' ? notBefore : Date.parse(notBefore) || 0;
  const diagnostics = [];
  const safeUrl = value => { try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; } };
  const safeHeaders = headers => Object.fromEntries(Object.entries(headers || {}).map(([name, value]) => [name.toLowerCase(), value]).filter(([name]) => ['server', 'cf-mitigated', 'cf-ray', 'content-type', 'retry-after', 'etag', 'last-modified'].includes(name)));
  const read = async value => {
    if (!isIcyRotationUrl(value)) throw new Error('Browser refresh accepts only Icy Veins rotation guides.');
    const request = queue.then(async () => {
      if (Date.now() < retryAt) throw new Error('Icy Veins requested a later retry; saved guide kept.');
      if (unavailable) throw unavailable;
      try { browser ||= await launch(path.join(directory, 'guide-browser-isolated')); }
      catch (error) { unavailable = error; throw error; }
      let targetId;
      let stopListening;
      let frameId;
      let page;
      const documents = [];
      const diagnostic = { url: value, checkedAt: new Date().toISOString(), mode: browser.mode || (browser.isolation ? 'isolated-desktop' : 'headless'), documents };
      try {
        ({ targetId } = await browser.send('Target.createTarget', { url: 'about:blank', ...(browser.isolation ? {} : { hidden: true }) }));
        const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
        if (browser.listen) {
          stopListening = browser.listen(event => {
            if (event.sessionId !== sessionId || event.params?.type !== 'Document') return;
            const response = event.method === 'Network.responseReceived' ? event.params.response : event.method === 'Network.requestWillBeSent' ? event.params.redirectResponse : null;
            if (response) {
              documents.push({ frameId: event.params.frameId, url: safeUrl(response.url), status: response.status, fromCache: Boolean(response.fromDiskCache || response.fromServiceWorker || response.fromPrefetchCache), headers: safeHeaders(response.headers) });
              if (documents.length > 16) documents.shift();
            }
          });
          await browser.send('Network.enable', {}, sessionId);
          await browser.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
        }
        const navigation = await browser.send('Page.navigate', { url: value }, sessionId);
        frameId = navigation.frameId;
        if (navigation.errorText) throw new Error(`Guide browser: ${navigation.errorText}`);
        const deadline = Date.now() + timeout;
        let challenged = false;
        do {
          let response;
          try {
            response = await browser.send('Runtime.evaluate', {
              expression: `JSON.stringify({ url: location.href, ready: document.readyState !== 'loading' && Boolean(document.querySelector('.page_content')), title: document.title, html: document.documentElement?.outerHTML || '' })`,
              returnByValue: true,
            }, sessionId);
          } catch (error) {
            if (!/context|navigat/i.test(error.message)) throw error;
            await pause(250);
            continue;
          }
          const { result, exceptionDetails } = response;
          if (exceptionDetails) throw new Error(`Guide browser could not read the article: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
          page = JSON.parse(result.value);
          const document = documents.filter(document => document.frameId === frameId).at(-1);
          if ([403, 429].includes(document?.status) || document?.headers['cf-mitigated'] === 'challenge') {
            const retry = String(document.headers['retry-after'] || '');
            const until = /^\d+$/.test(retry) ? Date.now() + Number(retry) * 1000 : Date.parse(retry);
            if (Number.isFinite(until)) retryAt = until;
            unavailable = new Error(`Icy Veins denied automatic article access (HTTP ${document.status}); saved guide kept.`);
            throw unavailable;
          }
          if (page.ready) {
            if (page.url !== value || page.html.length > 8_000_000) throw new Error('Guide browser returned an unexpected page.');
            if (document?.status >= 400) throw new Error('Guide browser received an access denial; saved guide kept.');
            diagnostic.success = true;
            return page.html;
          }
          challenged ||= /just a moment|verify (?:you are|that you are) human|challenge-platform|cf-error-details/i.test(page.title + page.html);
          await pause(250);
        } while (Date.now() < deadline);
        if (challenged) {
          unavailable = new Error('Icy Veins requires browser verification; saved guide kept.');
          throw unavailable;
        }
        throw new Error('Browser guide load timed out; saved guide kept.');
      } catch (error) { diagnostic.error = error.message; throw error; }
      finally {
        stopListening?.();
        diagnostic.finalUrl = safeUrl(page?.url || value);
        diagnostic.title = String(page?.title || '').slice(0, 160);
        diagnostic.documents = documents.filter(document => document.frameId === frameId).map(({ frameId, ...document }) => document);
        diagnostics.push(diagnostic);
        if (targetId) await browser.send('Target.closeTarget', { targetId }).catch(() => {});
      }
    });
    // Keep one browser and one active guide throughout a source check.
    queue = request.catch(() => {});
    return request;
  };
  read.diagnostics = diagnostics;
  read.retryAt = () => retryAt ? new Date(retryAt).toISOString() : null;
  read.isolation = () => browser?.isolation || null;
  read.close = async () => { await queue; if (browser) { await browser.close(); browser = null; } };
  return read;
}
