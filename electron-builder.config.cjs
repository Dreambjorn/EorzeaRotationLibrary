module.exports = {
  appId: 'Eorzea.RotationLibrary.Portable',
  productName: 'Eorzea Rotation Library',
  directories: { output: '.build-cache/packaging' },
  asar: true,
  npmRebuild: false,
  files: [
    'desktop/*.mjs', 'server.mjs', 'lib/*.mjs', 'public/index.html', 'public/app.js', 'public/styles.css',
    'public/manifest.webmanifest', 'public/favicon.svg', 'public/aetheryte-crystal.*', 'package.json',
    '!node_modules/**',
  ],
  win: {
    target: [{ target: 'portable', arch: ['x64'] }],
    icon: 'public/aetheryte-crystal.ico',
    artifactName: 'Eorzea-Rotation-Library-${version}-portable-${arch}.exe',
    requestedExecutionLevel: 'asInvoker',
  },
  portable: { requestExecutionLevel: 'user', unpackDirName: false },
};
