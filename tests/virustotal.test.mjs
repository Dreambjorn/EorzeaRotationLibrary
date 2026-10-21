import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRelease } from '../scripts/virustotal.mjs';

const api = 'https://www.virustotal.com/api/v3';
const stats = { malicious: 0, suspicious: 0, undetected: 70, harmless: 1, timeout: 2, 'confirmed-timeout': 1, failure: 0, 'type-unsupported': 3 };
const analysis = (status = 'completed', values = {}) => ({ data: { type: 'analysis', id: 'release-analysis', attributes: { status, date: 1792504800, stats, ...values } } });
const uploaded = { data: { type: 'analysis', id: 'release-analysis' } };
const identity = sha256 => ({ data: { type: 'file', id: sha256, attributes: { sha256 } } });

async function fixture(t, size) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eorzea-release-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  const filename = path.join(directory, 'EorzeaRotationLibrary.exe');
  await writeFile(filename, 'MZ synthetic release test bytes');
  if (size) await truncate(filename, size);
  const file = await openAsBlob(filename);
  const hash = createHash('sha256');
  for await (const chunk of file.stream()) hash.update(chunk);
  return { filename, hash: hash.digest('hex') };
}

function service(responses) {
  const calls = [], waits = [];
  let time = 0;
  return { calls, waits, options: {
    apiKey: 'synthetic-test-key',
    now: () => time,
    pause: async milliseconds => { waits.push(milliseconds); time += milliseconds; },
    fetcher: async (url, options) => {
      calls.push({ url, options, time });
      assert.equal(options.headers['x-apikey'], 'synthetic-test-key');
      assert.equal(options.redirect, 'error');
      const response = responses.shift();
      assert.ok(response, 'No unexpected API request should occur.');
      if (response instanceof Error) throw response;
      return response instanceof Response ? response : Response.json(response);
    },
  } };
}

test('Release scans wait for completed results and bind reports to exact EXE bytes', async t => {
  const file = await fixture(t);
  const mock = service([uploaded, analysis('queued'), analysis('in-progress'), analysis(), identity(file.hash)]);
  const report = await scanRelease(file.filename, file.hash, mock.options);
  assert.deepEqual(report.stats, stats);
  assert.equal(report.status, 'completed');
  assert.equal(report.sha256, file.hash);
  assert.equal(report.url, 'https://www.virustotal.com/gui/file/' + file.hash + '/detection');
  assert.equal(report.analyzedAt, new Date(1792504800 * 1000).toISOString());
  assert.equal(mock.calls[0].url, api + '/files');
  assert.equal(mock.calls[0].options.method, 'POST');
  const body = mock.calls[0].options.body;
  assert.equal(body.get('file').name, 'EorzeaRotationLibrary.exe');
  assert.equal(createHash('sha256').update(Buffer.from(await body.get('file').arrayBuffer())).digest('hex'), file.hash);
  assert.equal(mock.calls.at(-1).url, api + '/files/' + file.hash);
  assert.ok(mock.calls.every((call, index) => !index || call.time - mock.calls[index - 1].time >= 20_000));
});

test('Large release EXEs use VirusTotal large-file upload URLs', async t => {
  const file = await fixture(t, 32 * 1024 * 1024 + 1);
  const upload = 'https://www.virustotal.com/_ah/upload/synthetic-release';
  const mock = service([{ data: upload }, uploaded, analysis(), identity(file.hash)]);
  await scanRelease(file.filename, file.hash, mock.options);
  assert.equal(mock.calls[0].url, api + '/files/upload_url');
  assert.equal(mock.calls[1].url, upload);
  assert.equal(mock.calls[1].options.body.get('file').size, 32 * 1024 * 1024 + 1);
});

test('Missing credentials and mismatched EXE hashes never upload files', async t => {
  const file = await fixture(t);
  const mock = service([]);
  await assert.rejects(scanRelease(file.filename, file.hash, { ...mock.options, apiKey: '' }), /repository Actions secret/);
  await assert.rejects(scanRelease(file.filename, 'invalid', mock.options), /SHA256 is missing or invalid/);
  await assert.rejects(scanRelease(file.filename, '0'.repeat(64), mock.options), /does not match its SHA256/);
  assert.equal(mock.calls.length, 0);
});

for (const upload of ['http://www.virustotal.com/_ah/upload/test', 'https://example.com/_ah/upload/test', 'https://www.virustotal.com.evil.example/_ah/upload/test', 'https://user:password@www.virustotal.com/_ah/upload/test', 'https://www.virustotal.com:8443/_ah/upload/test', 'https://www.virustotal.com/other']) {
  test('Untrusted upload destinations never receive EXE bytes or API credentials: ' + upload, async t => {
    const file = await fixture(t, 32 * 1024 * 1024 + 1);
    const mock = service([{ data: upload }]);
    await assert.rejects(scanRelease(file.filename, file.hash, mock.options), /unexpected upload destination/);
    assert.equal(mock.calls.length, 1);
  });
}

test('Rate limits receive a bounded delay before retrying', async t => {
  const file = await fixture(t);
  const mock = service([new Response('rate limited', { status: 429 }), uploaded, analysis(), identity(file.hash)]);
  await scanRelease(file.filename, file.hash, mock.options);
  assert.equal(mock.waits[0], 60_000);
  assert.equal(mock.calls.length, 4);
});

test('Exhausted rate-limit retries stop release scanning', async t => {
  const file = await fixture(t);
  const mock = service(Array.from({ length: 3 }, () => new Response('rate limited', { status: 429 })));
  await assert.rejects(scanRelease(file.filename, file.hash, mock.options), /HTTP 429/);
  assert.equal(mock.calls.length, 3);
});

test('API and network errors do not expose response bodies or credentials', async t => {
  const file = await fixture(t);
  for (const response of [new Response('synthetic-test-key should remain hidden', { status: 401 }), new Error('synthetic-test-key transport error'), new Response('synthetic-test-key invalid JSON')]) {
    const mock = service([response]);
    await assert.rejects(scanRelease(file.filename, file.hash, mock.options), error => {
      assert.doesNotMatch(error.message, /synthetic-test-key/);
      return /VirusTotal/.test(error.message);
    });
  }
});

test('Incomplete scans expire rather than becoming release reports', async t => {
  const file = await fixture(t);
  const mock = service([uploaded, ...Array.from({ length: 50 }, () => analysis('queued'))]);
  await assert.rejects(scanRelease(file.filename, file.hash, mock.options), /did not finish within 15 minutes/);
});

test('Completed analyses still require valid engine results and dates', async t => {
  const file = await fixture(t);
  for (const attributes of [{ stats: {} }, { stats: { ...stats, malicious: -1 } }, { stats: { ...stats, suspicious: '0' } }, { stats: Object.fromEntries(Object.keys(stats).map(key => [key, 0])) }, { date: 'invalid' }, { date: 0 }, { status: 'unknown' }]) {
    const mock = service([uploaded, analysis('completed', attributes)]);
    await assert.rejects(scanRelease(file.filename, file.hash, mock.options), /VirusTotal/);
  }
});

test('Different analysis IDs or file hashes cannot become release reports', async t => {
  const file = await fixture(t);
  const otherAnalysis = analysis();
  otherAnalysis.data.id = 'other-analysis';
  const mock = service([uploaded, otherAnalysis]);
  await assert.rejects(scanRelease(file.filename, file.hash, mock.options), /different analysis/);
  const wrongFile = service([uploaded, analysis(), identity('f'.repeat(64))]);
  await assert.rejects(scanRelease(file.filename, file.hash, wrongFile.options), /does not match the release EXE/);
});

test('Detections remain visible instead of becoming a clean verdict', async t => {
  const file = await fixture(t);
  const mock = service([uploaded, analysis('completed', { stats: { ...stats, malicious: 2, suspicious: 1 } }), identity(file.hash)]);
  const report = await scanRelease(file.filename, file.hash, mock.options);
  assert.equal(report.stats.malicious, 2);
  assert.equal(report.stats.suspicious, 1);
});
