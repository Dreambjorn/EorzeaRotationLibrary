import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (process.platform !== 'win32') throw new Error('This desktop build targets Windows.');
const cache = path.join(root, '.build-cache');
const temporary = path.join(cache, 'temp');
await mkdir(temporary, { recursive: true });
process.env.electron_config_cache = path.join(cache, 'electron');
process.env.ELECTRON_BUILDER_CACHE = path.join(cache, 'electron-builder');
process.env.ELECTRON_INSTALL_ARCH = 'x64';
process.env.TEMP = temporary;
process.env.TMP = temporary;
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
const installed = spawnSync(process.execPath, [path.join(root, 'node_modules/electron/install.js')], {
  cwd: root, env: process.env, windowsHide: true, stdio: 'inherit',
});
if (installed.error) throw installed.error;
if (installed.status !== 0) throw new Error('Electron could not be prepared.');
const electron = path.join(root, 'node_modules/electron/dist');
if (process.argv.includes('--start')) {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.join(electron, 'electron.exe'), ['.'], {
    cwd: root, env: environment, windowsHide: true, stdio: 'inherit',
  });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code || 0; });
} else {
  const { build, Platform, Arch } = await import('electron-builder');
  const config = (await import('../electron-builder.config.cjs')).default;
  const outputs = await build({ targets: Platform.WINDOWS.createTarget('portable', Arch.x64),
    config: { ...config, electronDist: electron, publish: null } });
  await mkdir(path.join(root, 'dist'), { recursive: true });
  for (const output of outputs) {
    if (!output.endsWith('.exe')) continue;
    const filename = path.basename(output);
    await copyFile(output, path.join(root, 'dist', filename));
    console.log(`Created dist/${filename}`);
  }
}
