import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const uri = require('fast-uri');
const asar = require('@electron/asar');
const archiveRequire = createRequire(require.resolve('@electron/asar'));
const glob = archiveRequire('glob');
const minimatch = archiveRequire('minimatch');

test('Build URI handling rejects encoded schemes and malformed hosts', () => {
  assert.ok(uri.parse('%6Aavascript:alert(1)').error);
  assert.equal(uri.normalize('%6Aavascript:alert(1)'), '%6Aavascript:alert(1)');
  assert.throws(() => uri.resolve('https://example.com/', '%6Aavascript:alert(1)'));
  assert.ok(uri.parse('http://a@b@evil.example/').error);
  assert.ok(uri.parse('http://exa\tmple.com/').error);
});

test('Build URI normalization preserves relative paths and escapes suffix colons', () => {
  const base = 'https://example.com/docs/page/';
  for (const reference of ['a/../b', '../x']) {
    assert.equal(uri.resolve(base, uri.normalize(reference)), uri.resolve(base, reference));
  }
  const suffix = uri.serialize({ path: 'javascript:alert(1)' }, { reference: 'suffix' });
  assert.equal(suffix, 'javascript%3Aalert(1)');
  assert.equal(uri.parse(suffix).scheme, undefined);
});

test('Legacy matching uses bounded globstar preprocessing and callable exports', () => {
  assert.equal(minimatch('assets/icon.png', '**/*.png'), true);
  assert.equal(minimatch('assets/icon.txt', '**/*.png'), false);
  const pattern = '**/../a/'.repeat(12) + 'target';
  const parsed = new minimatch.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 32 });
  assert.ok(parsed.globParts.length <= 32);
  assert.equal(parsed.match('unrelated.txt'), false);
});

test('Archive tooling preserves callbacks, globbing, unpacking, and extraction', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eorzea-build-'));
  try {
    const source = path.join(directory, 'source');
    await mkdir(path.join(source, 'assets'), { recursive: true });
    await writeFile(path.join(source, 'main.js'), 'console.log("fixture");\n');
    await writeFile(path.join(source, 'assets', 'icon.txt'), 'fixture icon');
    await writeFile(path.join(source, '.hidden'), 'hidden fixture');
    const pattern = path.join(source, '**', '*');
    const found = await promisify(glob)(pattern, { dot: true, nodir: true });
    assert.deepEqual([...found].sort(), glob.sync(pattern, { dot: true, nodir: true }).sort());
    assert.equal(found.length, 3);
    await assert.rejects(promisify(glob)([null]), TypeError);
    const comparison = require('dir-compare').compareSync(source, source, { includeFilter: '*.txt', compareContent: true });
    assert.equal(comparison.same, true);
    assert.equal(comparison.equalFiles, 1);
    const listed = new (require('filelist').FileList)();
    listed.include(path.join(source, '**', '*.txt'));
    assert.deepEqual(listed.toArray().map(filename => path.resolve(filename)), [path.join(source, 'assets', 'icon.txt')]);
    const archive = path.join(directory, 'fixture.asar');
    await asar.createPackageWithOptions(source, archive, { unpack: '*.txt' });
    assert.equal(asar.extractFile(archive, 'main.js').toString(), 'console.log("fixture");\n');
    assert.equal(asar.extractFile(archive, 'assets/icon.txt').toString(), 'fixture icon');
    assert.equal(asar.statFile(archive, 'assets/icon.txt').unpacked, true);
    assert.equal(asar.extractFile(archive, '.hidden').toString(), 'hidden fixture');
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('Legacy cleanup handles wildcard paths through callbacks and synchronous calls', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eorzea-cleanup-'));
  try {
    const rimraf = require('rimraf');
    await writeFile(path.join(directory, 'remove.txt'), 'discard fixture');
    await writeFile(path.join(directory, 'keep.js'), 'keep fixture');
    await promisify(rimraf)(path.join(directory, '*.txt'));
    assert.deepEqual(glob.sync(path.join(directory, '*')).map(filename => path.basename(filename)), ['keep.js']);
    rimraf.sync(path.join(directory, 'keep.js'));
    assert.deepEqual(glob.sync(path.join(directory, '*')), []);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
