import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { changedReferences, pendingNotifications, ROTATION_COMPARISON_VERSION } from '../lib/updates.mjs';
import { fingerprintDiagrams, fetchJob } from '../lib/sources.mjs';
import { JOBS } from '../lib/catalog.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function guide(image = {}) {
  return { url: 'https://www.thebalanceffxiv.com/jobs/example/basic-guide/', contentVersion: ROTATION_COMPARISON_VERSION,
    sections: [{ title: 'Opener', rank: 1, blocks: [{ text: 'Use the ready damage cooldown.' }], images: [{ id: 'guide-test', url: 'https://www.thebalanceffxiv.com/img/jobs/example/opener.png', title: 'Opener', ...image }] }] };
}
const compare = (before, after) => changedReferences({ guides: [before] }, { id: 'EXAMPLE', guides: [after] }, '2026-10-20', hash);
test('Relevant diagram URL and same-URL byte changes both request review', () => {
  assert.equal(compare(guide(), guide({ url: 'https://www.thebalanceffxiv.com/img/jobs/example/new-opener.png' })).length, 1);
  assert.equal(compare(guide({ contentHash: 'before' }), guide({ contentHash: 'after' })).length, 1);
});
test('First hash baseline, unchanged diagrams, and stale downloads remain quiet', () => {
  assert.equal(compare(guide(), guide({ contentHash: 'first-baseline' })).length, 0);
  assert.equal(compare(guide({ contentHash: 'same' }), guide({ contentHash: 'same' })).length, 0);
  assert.equal(compare(guide({ contentHash: 'before' }), guide({ contentHash: 'after', stale: true })).length, 0);
  assert.equal(compare(guide({ contentHash: 'before', stale: true }), guide({ contentHash: 'after' })).length, 1);
});
test('Action icons and gauge illustrations do not trigger rotation notifications', () => {
  const before = guide({ url: 'https://www.thebalanceffxiv.com/img/jobs/example/gauge.png', contentHash: 'before' });
  const after = guide({ url: 'https://www.thebalanceffxiv.com/img/jobs/example/gauge.png', contentHash: 'after' });
  assert.equal(compare(before, after).length, 0);
});
test('Existing version-two text and diagram baselines remain comparable', () => {
  const before = { ...guide(), contentVersion: 2 };
  assert.equal(compare(before, guide({ url: 'https://www.thebalanceffxiv.com/img/jobs/example/new-opener.png' })).length, 1);
});
test('Leveling publisher dates create a distinct source-review notice', () => {
  const before = { url: 'https://www.icy-veins.com/ffxiv/example-leveling', externalLeveling: true, lastModified: '2026-09-01', sections: [] };
  const after = { ...before, lastModified: '2026-10-20' };
  const updates = compare(before, after);
  assert.equal(updates[0].kind, 'source-review');
  assert.match(updates[0].summary, /has not been confirmed/);
  assert.equal(pendingNotifications([{ name: 'Example', reviewUpdates: updates }]).length, 1);
  assert.equal(pendingNotifications([{ name: 'Example', reviewUpdates: updates }], [updates[0].id]).length, 0);
  assert.equal(compare(before, { ...after, metadataStale: true }).length, 0);
});
test('Diagram refresh hashes new bytes at the same URL', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eorzea-diagram-'));
  try {
    let bytes = Buffer.from('first synthetic image bytes');
    const fetcher = async () => new Response(bytes, { headers: { 'content-type': 'image/png' } });
    const before = await fingerprintDiagrams(guide(), directory, fetcher);
    bytes = Buffer.from('second synthetic image bytes');
    const after = await fingerprintDiagrams(guide(), directory, fetcher, before);
    assert.equal(compare(before, after).length, 1);
    const stale = await fingerprintDiagrams(guide(), directory, async () => { throw new Error('Offline'); }, after);
    assert.equal(stale.sections[0].images[0].stale, true);
    assert.equal(compare(after, stale).length, 0);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
test('Beastmaster imports the known ClassJob-zero Borrow replacements', async () => {
  const requested = [];
  const fetcher = async value => {
    const url = new URL(value);
    if (url.hostname === 'na.finalfantasyxiv.com') return new Response('<p>Maximum level of 50</p>');
    const fields = id => ({ Name: 'Synthetic action ' + id, Icon: { id: 62000 }, ClassJobLevel: 22, ActionCategory: { fields: { Name: 'Ability' } }, IsPlayerAction: true, IsPvP: false });
    if (url.pathname.endsWith('/search')) return Response.json({ results: Array.from({ length: 10 }, (_, index) => ({ row_id: index + 1, fields: fields(index + 1) })), version: 'test' });
    const id = Number(url.pathname.split('/').at(-1));
    if (url.searchParams.get('fields') !== 'Description') requested.push(id);
    return Response.json({ fields: fields(id), transient: { Description: 'Synthetic player action description.' } });
  };
  const result = await fetchJob(JOBS.find(job => job.id === 'BST'), null, fetcher);
  assert.deepEqual(requested, [44896, 44897, 44898, 44899, 44900, 44901, 44902, 44903]);
  assert.equal(result.actions.length, 18);
  assert.equal(result.referenceReviewedAt, null);
});
