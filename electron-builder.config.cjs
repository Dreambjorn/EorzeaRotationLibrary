module.exports = {
  appId: 'Eorzea.RotationLibrary.Portable',
  productName: 'Eorzea Rotation Library',
  directories: { output: '.build-cache/packaging' },
  asar: true,
  npmRebuild: false,
  files: [
    'desktop/*.mjs', 'server.mjs', 'lib/*.mjs', 'public/index.html', 'public/app.js', 'public/styles.css',
    'public/manifest.webmanifest', 'public/crystal.*', 'package.json',
    '!node_modules/**',
  ],
  extraResources: [
    { from: 'LICENSE', to: 'licenses/LICENSE' },
  ],
  win: {
    target: [{ target: 'portable', arch: ['x64'] }],
    icon: 'public/crystal.ico',
    artifactName: 'Eorzea-Rotation-Library-${version}-portable-${arch}.exe',
    requestedExecutionLevel: 'asInvoker',
  },
  portable: { requestExecutionLevel: 'user', unpackDirName: false },
};
