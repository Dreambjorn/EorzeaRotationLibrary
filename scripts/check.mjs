import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['server.mjs', 'electron-builder.config.cjs'];
for (const directory of ['lib', 'desktop', 'public', 'scripts', 'tests']) {
  for (const name of await readdir(path.join(root, directory))) if (/\.(mjs|cjs|js)$/.test(name)) files.push(path.join(directory, name));
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('Syntax checked ' + files.length + ' JavaScript modules.');
