import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { JOBS, iconAsset, normalize } from './catalog.mjs';
import { changedReferences, isRotationUpdate, ROTATION_COMPARISON_VERSION } from './updates.mjs';
import { createBrowserGuideReader } from './browser.mjs';

export const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const USER_AGENT = 'EorzeaRotationLibrary/0.1 (local personal reference)';
const ASSET_HOSTS = new Set(['lds-img.finalfantasyxiv.com', 'v2.xivapi.com', 'www.thebalanceffxiv.com', 'static.icy-veins.com']);
const hash = text => createHash('sha256').update(text).digest('hex');

export function plainText(html) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', times: '×' };
  return html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&#(x[\da-f]+|\d+);/gi, (_, value) => {
      const point = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }).replace(/&([a-z]+);/gi, (match, key) => entities[key.toLowerCase()] ?? match)
    .replace(/[\t\r ]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

function cell(row, className) {
  return row.match(new RegExp(`<td[^>]+class="${className}"[^>]*>([\\s\\S]*?)<\\/td>`))?.[1] || '';
}

function distinguishRoleTrait(job, action) {
  if (action.category || !/-(?:tank|healer|melee|prange|mrange)_action__/.test(action.id)) return action;
  const id = action.id.replace(`${job.id}-`, `${job.id}-trait-`);
  return { ...action, id, category: 'Trait', icon: `/api/icons/${id}.png` };
}

export function parseOfficial(html, job) {
  const actions = [];
  for (const row of html.matchAll(/<tr\s+id="((?:pve_|(?:tank|healer|melee|prange|mrange)_action__)[^\"]+)"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const skill = cell(row[2], 'skill');
    const name = plainText(skill.match(/<strong[^>]*>([\s\S]*?)<\/strong>/)?.[1] || '');
    const iconUrl = skill.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const level = Number(plainText(cell(row[2], 'jobclass')).match(/Lv\.\s*(\d+)/)?.[1] || 1);
    if (!name || !iconUrl || !isAllowedAsset(iconUrl)) continue;
    actions.push({
      id: `${job.id}-${row[1]}`, name, level,
      category: plainText(cell(row[2], 'classification')),
      cast: plainText(cell(row[2], 'cast')),
      recast: plainText(cell(row[2], 'recast')),
      cost: plainText(cell(row[2], 'cost')),
      description: plainText(cell(row[2], 'content')),
      iconUrl, icon: `/api/icons/${job.id}-${row[1]}.png`,
      source: `${job.official}#${row[1]}`,
    });
  }
  if (job.id === 'AST') for (const action of actions) {
    const parent = /^(The Balance|The Arrow|The Spire|The Spear|The Bole|The Ewer)$/.test(action.name) ? 'Astral Draw' : /^(Lord|Lady) of Crowns$/.test(action.name) ? 'Minor Arcana' : null;
    if (parent) action.level = actions.find(candidate => candidate.name === parent)?.level || action.level;
  }
  const unique = actions.filter((action, i) => actions.findIndex(other => normalize(other.name) === normalize(action.name)) === i).map(action => distinguishRoleTrait(job, action));
  if (unique.length < 10) throw new Error(`Official action table was not recognized for ${job.name}`);
  return unique;
}

function rangeFor(title) {
  let match = title.match(/sub[- ]?level\s*(\d+)/i);
  if (match) return { minLevel: 1, maxLevel: Number(match[1]) - 1 };
  match = title.match(/levels?\s*(\d+)\s*[-–—]\s*(\d+)/i);
  if (match) return { minLevel: Number(match[1]), maxLevel: Number(match[2]) };
  match = title.match(/levels?\s*(\d+)/i);
  if (match) return { minLevel: Number(match[1]), maxLevel: null };
  return null;
}

export function parseGuide(html, url, type) {
  const start = html.search(/<div class="markdown max-w-none">/);
  if (start === -1) throw new Error('Guide article markup was not recognized');
  const end = html.indexOf('<div class="tabbed', start);
  const article = html.slice(start, end === -1 ? undefined : end).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  const sections = [];
  const stack = [];
  let current;
  const pattern = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*src=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi;
  for (const match of article.matchAll(pattern)) {
    if (match[1]?.startsWith('h')) {
      const rank = Number(match[1][1]);
      const title = plainText(match[2]);
      while (stack.length && stack.at(-1).rank >= rank) stack.pop();
      const parent = stack.at(-1);
      const range = rangeFor(title) || (parent ? { minLevel: parent.minLevel, maxLevel: parent.maxLevel } : { minLevel: type === 'basic-guide' ? 100 : 1, maxLevel: null });
      const mode = /aoe|multi[- ]?target|area.of.effect/i.test(title) ? 'aoe' : /single[- ]?target/i.test(title) ? 'single' : parent?.mode || null;
      current = { title, rank, ...range, mode, blocks: [], images: [] };
      stack.push(current);
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: 'Rotation guidance', rank: 1, minLevel: type === 'basic-guide' ? 100 : 1, maxLevel: null, mode: null, blocks: [], images: [] };
      sections.push(current);
    }
    if (match[1]) {
      const text = plainText(match[2]);
      if (text && !/^(Authors|Contributors|Changelog|Have any questions)/i.test(text)) current.blocks.push({ text, list: match[1] === 'li' });
      for (const image of match[2].matchAll(/<img[^>]+src=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) addImage(current, image[1] || image[2] || image[3], url);
    } else addImage(current, match[3] || match[4] || match[5], url);
  }
  if (!sections.some(section => section.blocks.length || section.images.length)) throw new Error('Guide article was empty');
  return {
    type, url, sections, contentVersion: ROTATION_COMPARISON_VERSION,
    updated: html.match(/itemprop=dateModified content="([^"]+)"/)?.[1] || null,
    patch: plainText(html.match(/Patch Applicable:[\s\S]{0,250}/)?.[0] || '').match(/\b\d+\.\d+\b/)?.[0] || null,
    fingerprint: hash(article),
  };
}

export function parseIcySitemap(xml) {
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>[\s\S]*?<\/url>/g)]
    .map(match => ({ url: match[1], lastModified: match[2] }));
  const guides = JOBS.flatMap(job => entries.filter(entry => {
    const base = `https://www.icy-veins.com/ffxiv/${job.slug}`;
    return entry.url === `${base}-leveling` || entry.url === `${base}-dps-rotation-for-healers` || entry.url.startsWith(`${base}-pve-`) && entry.url.endsWith('-rotation-openers-abilities');
  }).map(entry => ({ ...entry, job: job.id, publisher: 'Icy Veins', type: entry.url.endsWith('-leveling') ? 'icy-leveling' : 'icy-rotation' })));
  if (guides.length < 20) throw new Error('Icy Veins guide sitemap was not recognized');
  return guides;
}

function divEnd(html, start) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  let tag;
  while ((tag = tags.exec(html))) {
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (!depth) return tags.lastIndex;
  }
  throw new Error('Icy Veins article boundary was incomplete');
}

export function parseIcyGuide(html, url, type, cap = 100) {
  html = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  const opening = /<div\b[^>]*class=["'][^"']*\bpage_content\b[^"']*["'][^>]*>/i.exec(html);
  if (!opening) throw new Error('Icy Veins article markup was not recognized');
  let article = html.slice(opening.index + opening[0].length, divEnd(html, opening.index) - 6);
  let ad;
  while ((ad = /<div\b[^>]*class=["'][^"']*\bin-content-ad\b[^"']*["'][^>]*>/i.exec(article)))
    article = article.slice(0, ad.index) + article.slice(divEnd(article, ad.index));
  const widgets = [];
  let widget;
  while ((widget = /<div\b[^>]*\bdata-ffxivtool=["'][^"']+["'][^>]*>/i.exec(article))) {
    const rotation = widget[0].match(/\bdata-ffxivtool-rotationhash=["']([^"']+)["']/)?.[1];
    const dataPath = widget[0].match(/\bdata-ffxivtool-jsonpath=["']([^"']+)["']/)?.[1] || '';
    const headings = [...article.slice(0, widget.index).matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    if (rotation) widgets.push({ rotation, dataPath, title: plainText(headings.at(-1)?.[1] || 'Published rotation example') });
    article = article.slice(0, widget.index) + '<p>Interactive rotation example. Open the original guide to view it.</p>' + article.slice(divEnd(article, widget.index));
  }
  const changelog = article.search(/<h[12]\b[^>]*id=["']changelog["']/i);
  if (changelog >= 0) article = article.slice(0, changelog);
  const parsed = parseGuide(`<div class="markdown max-w-none">${article}<div class="tabbed">`, url, type === 'icy-leveling' ? 'leveling-guide' : 'basic-guide');
  if (cap !== 100) for (const section of parsed.sections) if (section.minLevel === 100) section.minLevel = cap;
  const seconds = Number(html.match(/data-time=["'](\d+)["']/)?.[1]);
  return { ...parsed, type, publisher: 'Icy Veins', widgets,
    updated: seconds ? new Date(seconds * 1000).toISOString() : null,
    patch: plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').match(/\b\d+\.\d+\b/)?.[0] || null,
    fingerprint: hash(JSON.stringify({ text: plainText(article).replace(/\s+/g, ' '), images: parsed.sections.flatMap(section => section.images.map(image => image.url)), widgets })),
  };
}

function addImage(section, source, base) {
  try {
    const url = new URL(source, base).href;
    if (!isAllowedAsset(url) || /profile|author|emoji|icon|avatar/i.test(url)) return;
    if (!/\.(png|webp|jpe?g)(\?|$)/i.test(url)) return;
    if (section.images.some(image => image.url === url)) return;
    section.images.push({ url, id: `guide-${hash(url).slice(0, 20)}`, title: section.title });
  } catch {}
}

export function isAllowedAsset(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ASSET_HOSTS.has(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

async function getText(url, fetcher = fetch) {
  const response = await fetcher(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(25000), redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).hostname}`);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error('Source response was too large');
  return text;
}

async function limitedActions(job, fetcher) {
  const url = new URL('https://v2.xivapi.com/api/search');
  url.search = new URLSearchParams({ sheets: 'Action', query: `+ClassJob=${job.number} +IsPvP=false`, limit: '200', fields: 'Name,Icon,ClassJobLevel,Cast100ms,Recast100ms,ActionCategory.Name,IsPvP' });
  const result = JSON.parse(await getText(url.href, fetcher));
  if (result.next) throw new Error('Limited-job action list requires another page; keeping previous data');
  const actions = result.results?.filter(row => row.fields.Name && !row.fields.IsPvP && row.fields.Icon?.id).map(row => ({
    id: `${job.id}-${row.row_id}`, xivId: row.row_id, name: row.fields.Name,
    level: row.fields.ClassJobLevel || 1, category: row.fields.ActionCategory?.fields?.Name || 'Action',
    cast: row.fields.Cast100ms ? `${row.fields.Cast100ms / 10}s` : 'Instant',
    recast: `${row.fields.Recast100ms / 10}s`, cost: '',
    description: job.id === 'BLU' ? 'This spell must be learned and equipped before use. The displayed level is its action requirement, not the level at which you learn it.' : 'Familiar and instinctual affinity determine how this action fits your rotation. See the official Beastmaster guide.',
    iconUrl: iconAsset(row.fields.Icon.id), icon: `/api/icons/${job.id}-${row.row_id}.png`, source: job.official,
  }));
  if (!actions || actions.length < 10) throw new Error('Limited-job action list was incomplete');
  if (job.role === 'limited') {
    let index = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (index < actions.length) {
        const action = actions[index++];
        const detail = JSON.parse(await getText(`https://v2.xivapi.com/api/sheet/Action/${action.xivId}?fields=Description`, fetcher));
        if (detail.transient?.Description) action.description = plainText(detail.transient.Description);
      }
    }));
  }
  return { actions, version: result.version };
}

export async function fetchJob(job, previous, fetcher = fetch, icyGuides = [], browserReader = null, onActions = () => {}) {
  const now = new Date().toISOString();
  const failures = [];
  let actions;
  let officialHash;
  let officialHtml;
  let apiVersion;
  try {
    officialHtml = await getText(job.official, fetcher);
    officialHash = hash(officialHtml);
    if (job.role === 'limited') {
      const result = await limitedActions(job, fetcher);
      actions = result.actions;
      apiVersion = result.version;
    } else actions = parseOfficial(officialHtml, job);
  } catch (error) {
    if (!previous?.actions?.length) throw error;
    actions = previous.actions;
    officialHash = previous.officialHash;
    failures.push({ source: job.official, error: error.message });
  }
  onActions({ ...job, actions, guides: [] });
  const guides = [];
  for (const guide of [...job.guides, ...icyGuides]) {
    try {
      if (guide.type === 'icy-leveling') {
        guides.push({ ...guide, sections: [], fingerprint: null, updated: guide.lastModified, checkedAt: now, stale: Boolean(guide.metadataStale), externalLeveling: true, monitoring: 'publisher-date' });
        continue;
      }
      let parsed;
      let contentSource = 'http';
      try {
        if (guide.publisher === 'Icy Veins' && browserReader && previous?.guides?.some(old => old.url === guide.url && old.contentSource === 'browser')) {
          parsed = parseIcyGuide(await browserReader(guide.url), guide.url, guide.type, job.cap);
          contentSource = 'browser';
        } else {
          const html = await getText(guide.url, fetcher);
          parsed = guide.publisher === 'Icy Veins' ? parseIcyGuide(html, guide.url, guide.type, job.cap) : parseGuide(html, guide.url, guide.type);
        }
      } catch (error) {
        if (guide.publisher !== 'Icy Veins' || !browserReader || previous?.guides?.some(old => old.url === guide.url && old.contentSource === 'browser')) throw error;
        try {
          parsed = parseIcyGuide(await browserReader(guide.url), guide.url, guide.type, job.cap);
          contentSource = 'browser';
        } catch (browserError) { throw new Error(`${error.message}. ${browserError.message}`); }
      }
      guides.push({ ...guide, ...parsed, publisher: guide.publisher || 'The Balance', checkedAt: now, contentCheckedAt: now, contentSource, stale: false });
    } catch (error) {
      const old = previous?.guides?.find(item => item.url === guide.url);
      if (guide.publisher === 'Icy Veins' && guide.lastModified) {
        guides.push({ ...old, ...guide, sections: old?.sections || [], fingerprint: old?.fingerprint || null, updated: old?.updated || guide.lastModified, checkedAt: now, stale: true, contentError: error.message, monitoring: 'publisher-date' });
      } else {
        if (old) guides.push({ ...old, stale: true, contentError: error.message });
        failures.push({ source: guide.url, error: error.message });
      }
    }
  }
  let cap = job.cap;
  if (job.role === 'limited' && officialHtml) cap = Number(plainText(officialHtml).match(/maximum level of\s+(\d+)/i)?.[1] || cap);
  const updates = changedReferences(previous, { ...job, actions, guides }, now, hash);
  const reviewUpdates = [...updates, ...(previous?.reviewUpdates || []).filter(isRotationUpdate)].filter((update, index, all) => all.findIndex(other => other.id === update.id) === index).slice(0, 100);
  return {
    ...job, cap, actions, guides, officialHash, apiVersion, failures,
    reviewUpdates,
    legacyReviewUpdates: [...(previous?.legacyReviewUpdates || []), ...(previous?.reviewUpdates || []).filter(update => !isRotationUpdate(update))].slice(-100),
    checkedAt: now, updatedAt: previous?.updatedAt || now,
    referenceReviewedAt: previous?.referenceReviewedAt || now,
    referenceNeedsReview: reviewUpdates.length > 0,
    status: failures.length ? 'partial' : 'current',
  };
}

export async function readLibrary(directory) {
  try {
    const library = JSON.parse(await readFile(path.join(directory, 'library.json'), 'utf8'));
    if (library.schema !== 1 || !Array.isArray(library.jobs)) throw new Error('Unknown cache schema');
    for (const job of library.jobs) {
      if (job.actions) job.actions = job.actions.map(action => distinguishRoleTrait(job, action));
      const legacy = (job.reviewUpdates || []).filter(update => !isRotationUpdate(update));
      if (legacy.length) job.legacyReviewUpdates = [...(job.legacyReviewUpdates || []), ...legacy].slice(-100);
      if (job.reviewUpdates) job.reviewUpdates = job.reviewUpdates.filter(isRotationUpdate);
      if (job.referenceNeedsReview !== undefined) job.referenceNeedsReview = Boolean(job.reviewUpdates?.length);
    }
    return library;
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Cache could not be read:', error.message);
    return { schema: 1, jobs: [], changes: [], checkedAt: null };
  }
}

export async function writeLibrary(directory, library) {
  await mkdir(directory, { recursive: true });
  const filename = path.join(directory, 'library.json');
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(library));
  await rename(temporary, filename);
}

export async function refreshLibrary(directory, previous, { fetcher = fetch, onProgress = () => {}, onActions = () => {}, browserReader = fetcher === fetch ? createBrowserGuideReader(directory, { notBefore: previous.icyVeins?.browserRefresh?.retryAt }) : null } = {}) {
  let icyVeins = previous.icyVeins || { guides: [], checkedAt: null };
  try {
    icyVeins = { guides: parseIcySitemap(await getText('https://www.icy-veins.com/sitemap.xml', fetcher)), checkedAt: new Date().toISOString(), error: null };
  } catch (error) { icyVeins = { ...icyVeins, error: error.message }; }
  const jobs = new Array(JOBS.length);
  const changes = [];
  let index = 0;
  let completed = 0;
  try { await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < JOBS.length) {
      const slot = index++;
      const job = JOBS[slot];
      const old = previous.jobs.find(item => item.id === job.id);
      try {
        const references = icyVeins.guides.filter(guide => guide.job === job.id).map(guide => ({ ...guide, metadataStale: Boolean(icyVeins.error) }));
        const fresh = await fetchJob(job, old, fetcher, references, browserReader, onActions);
        const changed = old && (JSON.stringify(old.actions) !== JSON.stringify(fresh.actions) || old.guides.some(guide => fresh.guides.find(item => item.url === guide.url)?.fingerprint !== guide.fingerprint));
        if (changed) {
          fresh.updatedAt = new Date().toISOString();
          changes.push({ job: job.id, at: fresh.updatedAt, text: 'Published job data or rotation guidance changed.' });
        }
        jobs[slot] = fresh;
      } catch (error) {
        jobs[slot] = old ? { ...old, status: 'stale', failures: [{ source: job.official, error: error.message }] } : { ...job, actions: [], guides: [], status: 'unavailable', failures: [{ source: job.official, error: error.message }] };
      }
      onProgress({ completed: ++completed, total: JOBS.length, job: job.name });
    }
  })); } finally {
    if (browserReader?.diagnostics) icyVeins.browserRefresh = { checkedAt: new Date().toISOString(), retryAt: browserReader.retryAt?.(), isolation: browserReader.isolation?.(), requests: browserReader.diagnostics };
    await browserReader?.close?.();
  }
  const library = { schema: 1, jobs, icyVeins, checkedAt: new Date().toISOString(), changes: [...changes, ...(previous.changes || [])].slice(0, 100) };
  if (!jobs.some(job => job.actions.length)) throw new Error('All sources were unavailable; the previous cache was kept');
  await writeLibrary(directory, library);
  return library;
}

export function assetMap(library) {
  const map = new Map(JOBS.map(job => [`job-${job.id}`, { url: iconAsset(62000 + job.number), lifetime: 30 * 86400000 }]));
  for (const job of library.jobs) {
    for (const action of job.actions) map.set(action.id, { url: action.iconUrl, lifetime: 30 * 86400000 });
    for (const guide of job.guides) for (const section of guide.sections) for (const image of section.images) map.set(image.id, { url: image.url, lifetime: CHECK_INTERVAL });
  }
  return map;
}

const assetRequests = new Map();
export async function cachedAsset(directory, key, entry, fetcher = fetch) {
  if (!entry || !isAllowedAsset(entry.url)) throw new Error('Unknown image');
  const filename = path.join(directory, 'assets', `${hash(entry.url)}.bin`);
  await mkdir(path.dirname(filename), { recursive: true });
  let cached;
  try { cached = await stat(filename); } catch {}
  if (cached && Date.now() - cached.mtimeMs < entry.lifetime) return { bytes: await readFile(filename), stale: false };
  if (assetRequests.has(filename)) return assetRequests.get(filename);
  const task = (async () => {
    try {
      const response = await fetcher(entry.url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'error', signal: AbortSignal.timeout(20000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 8 || bytes.length > 8_000_000) throw new Error('Invalid image size');
      const temporary = `${filename}.${process.pid}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, filename);
      return { bytes, stale: false };
    } catch (error) {
      if (cached) return { bytes: await readFile(filename), stale: true };
      throw error;
    } finally { assetRequests.delete(filename); }
  })();
  assetRequests.set(filename, task);
  return task;
}

export function createAssetLoader(directory, { fetcher = fetch, workers = 12 } = {}) {
  if (!Number.isInteger(workers) || workers < 1) throw new Error('Invalid asset worker count');
  const controller = new AbortController();
  const tasks = new Map();
  const queue = [];
  let running = 0;
  let stopped = false;
  const download = (url, options) => fetcher(url, { ...options, signal: AbortSignal.any([options.signal, controller.signal]) });

  function pump() {
    while (!stopped && running < workers && queue.length) {
      const task = queue.shift();
      running++;
      cachedAsset(directory, task.key, task.entry, download).then(task.resolve, task.reject).finally(() => {
        tasks.delete(task.entry.url);
        running--;
        pump();
      });
    }
  }

  function get(key, entry, background = false) {
    if (stopped) return Promise.reject(new Error('Asset downloads stopped'));
    if (!entry || !isAllowedAsset(entry.url)) return Promise.reject(new Error('Unknown image'));
    let task = tasks.get(entry.url);
    if (task) {
      const index = background ? -1 : queue.indexOf(task);
      if (index >= 0) queue.unshift(...queue.splice(index, 1));
      return task.promise;
    }
    task = { key, entry };
    task.promise = new Promise((resolve, reject) => { task.resolve = resolve; task.reject = reject; });
    tasks.set(entry.url, task);
    if (background) queue.push(task);
    else queue.unshift(task);
    pump();
    return task.promise;
  }

  return {
    get,
    prefetch: entries => {
      for (const [key, entry] of entries) get(key, entry, true).catch(() => {});
    },
    close: async () => {
      stopped = true;
      const finished = Promise.allSettled([...tasks.values()].map(task => task.promise));
      controller.abort();
      for (const task of queue.splice(0)) {
        tasks.delete(task.entry.url);
        task.reject(new Error('Asset downloads stopped'));
      }
      await finished;
    },
  };
}
