import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRelease } from '../scripts/virustotal.mjs';

const stats = { malicious: 0, suspicious: 0, undetected: 1, harmless: 0, timeout: 0, 'confirmed-timeout': 0, failure: 0, 'type-unsupported': 0 };
const analysis = { data: { type: 'analysis', id: 'fixture-analysis', attributes: { status: 'completed', date: 1_700_000_000, stats } } };
const apiKey = 'fixture-api-key-never-log';
const upload = 'https://www.virustotal.com/_ah/upload/fixture-upload-token-never-log';

async function fixture(large, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eorzea-virustotal-'));
  try {
    const filename = path.join(directory, 'fixture.bin');
    const file = await open(filename, 'w');
    try { await file.truncate(large ? 32 * 1024 * 1024 + 1 : 32); } finally { await file.close(); }
    const hash = createHash('sha256').update(await readFile(filename)).digest('hex');
    await callback(filename, hash);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
}

function scanner(replies) {
  let time = 0;
  const messages = [], requests = [];
  return { messages, requests, options: {
    apiKey, now: () => time, pause: async delay => { time += delay; }, log: message => messages.push(message),
    fetcher: async (url, options) => {
      requests.push({ url, method: options.method || 'GET', time });
      assert.equal(options.headers['x-apikey'], apiKey);
      assert.equal(options.redirect, 'error');
      assert.ok(replies.length, 'Unexpected VirusTotal request.');
      return replies.shift();
    },
  } };
}

for (const [stage, before, large, status = 404, code = 'NotFoundError'] of [
  ['upload-url', [], true],
  ['file-upload', [], false],
  ['analysis-status', [analysis], false, 403, 'ForbiddenError'],
  ['file-report', [analysis, analysis], false],
]) {
  test(`VirusTotal identifies ${stage} failures without exposing response secrets`, async () => {
    await fixture(large, async (filename, hash) => {
      const replies = before.map(reply => Response.json(reply));
      replies.push(Response.json({ error: { code, message: `${apiKey} ${upload}` } }, { status }));
      const run = scanner(replies);
      await assert.rejects(scanRelease(filename, hash, run.options), error => {
        assert.equal(error.message, `VirusTotal ${stage} returned HTTP ${status} (${code}).`);
        return true;
      });
      const logged = run.messages.join('\n');
      assert.ok(logged.includes(`VirusTotal ${stage}: HTTP ${status}.`));
      assert.ok(!logged.includes(apiKey));
      assert.ok(!logged.includes('fixture-upload-token-never-log'));
    });
  });
}

test('VirusTotal large-file tracing preserves upload tokens and request spacing', async () => {
  await fixture(true, async (filename, hash) => {
    const run = scanner([Response.json({ data: upload }), Response.json(analysis), Response.json({ error: { code: 'ForbiddenError' } }, { status: 403 })]);
    await assert.rejects(scanRelease(filename, hash, run.options), /analysis-status returned HTTP 403/);
    assert.deepEqual(run.requests.map(request => request.time), [0, 20_000, 40_000]);
    assert.equal(run.requests[1].url, upload);
    assert.equal(run.requests[1].method, 'POST');
    assert.deepEqual(run.messages.filter(message => message.includes('HTTP')), [
      'VirusTotal upload-url: HTTP 200.', 'VirusTotal file-upload: HTTP 200.', 'VirusTotal analysis-status: HTTP 403.',
    ]);
    assert.ok(!run.messages.join('\n').includes('fixture-upload-token-never-log'));
  });
});

test('VirusTotal tracing preserves successful report validation', async () => {
  await fixture(false, async (filename, hash) => {
    const run = scanner([Response.json(analysis), Response.json(analysis), Response.json({ data: { type: 'file', id: hash, attributes: { sha256: hash } } })]);
    const report = await scanRelease(filename, hash, run.options);
    assert.equal(report.sha256, hash);
    assert.equal(report.status, 'completed');
    assert.deepEqual(report.stats, stats);
    assert.equal(report.url, 'https://www.virustotal.com/gui/file/' + hash + '/detection');
    assert.equal(run.messages.at(-1), 'VirusTotal file-report: HTTP 200.');
  });
});

test('VirusTotal waits for a newly uploaded analysis without uploading again', async () => {
  await fixture(false, async (filename, hash) => {
    const run = scanner([
      Response.json(analysis),
      Response.json({ error: { code: 'NotFoundError' } }, { status: 404 }),
      Response.json({ error: { code: 'NotFoundError' } }, { status: 404 }),
      Response.json(analysis),
      Response.json({ data: { type: 'file', id: hash, attributes: { sha256: hash } } }),
    ]);
    const report = await scanRelease(filename, hash, run.options);
    assert.equal(report.status, 'completed');
    assert.deepEqual(run.requests.map(request => request.time), [0, 20_000, 40_000, 60_000, 80_000]);
    assert.equal(run.requests.filter(request => request.method === 'POST').length, 1);
  });
});

test('VirusTotal stops waiting for a missing analysis at the existing deadline', async () => {
  await fixture(false, async (filename, hash) => {
    const replies = [Response.json(analysis), ...Array.from({ length: 45 }, () => Response.json({ error: { code: 'NotFoundError' } }, { status: 404 }))];
    const run = scanner(replies);
    await assert.rejects(scanRelease(filename, hash, run.options), /did not finish within 15 minutes/);
    assert.equal(run.requests.filter(request => request.method === 'POST').length, 1);
    assert.ok(run.requests.at(-1).time < 15 * 60_000);
  });
});

test('VirusTotal tolerates a missing analysis after an earlier successful poll', async () => {
  await fixture(false, async (filename, hash) => {
    const queued = { data: { ...analysis.data, attributes: { ...analysis.data.attributes, status: 'queued' } } };
    const run = scanner([
      Response.json(analysis), Response.json(queued),
      Response.json({ error: { code: 'NotFoundError' } }, { status: 404 }), Response.json(analysis),
      Response.json({ data: { type: 'file', id: hash, attributes: { sha256: hash } } }),
    ]);
    assert.equal((await scanRelease(filename, hash, run.options)).status, 'completed');
    assert.equal(run.requests.filter(request => request.method === 'POST').length, 1);
    const polls = run.requests.filter(request => request.url.includes('/analyses/'));
    assert.equal(polls.length, 3);
    assert.equal(new Set(polls.map(request => request.url)).size, 1);
  });
});

test('VirusTotal still rejects a different analysis after waiting for readiness', async () => {
  await fixture(false, async (filename, hash) => {
    const run = scanner([
      Response.json(analysis), Response.json({ error: { code: 'NotFoundError' } }, { status: 404 }),
      Response.json({ data: { ...analysis.data, id: 'unrelated-analysis' } }),
    ]);
    await assert.rejects(scanRelease(filename, hash, run.options), /returned a different analysis/);
    assert.equal(run.requests.filter(request => request.method === 'POST').length, 1);
    assert.ok(!run.requests.some(request => request.url.endsWith('/files/' + hash)));
  });
});

test('VirusTotal retains the transient-error retry limit after readiness polling', async () => {
  await fixture(false, async (filename, hash) => {
    const replies = [Response.json(analysis), Response.json({ error: { code: 'NotFoundError' } }, { status: 404 }),
      ...Array.from({ length: 3 }, () => Response.json({ error: { code: 'TransientError' } }, { status: 500 }))];
    const run = scanner(replies);
    await assert.rejects(scanRelease(filename, hash, run.options), /analysis-status returned HTTP 500 \(TransientError\)/);
    assert.equal(run.requests.length, 5);
  });
});
