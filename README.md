# Eorzea Rotation Library

A portable Windows desktop reference for all 23 FFXIV combat jobs.

## Build

Build on 64-bit Windows with Node.js 24 or newer and npm. An internet connection is required to download build dependencies.

Open a terminal in this folder and run:

```powershell
npm ci
npm run build
```

The portable app is created at `dist/Eorzea-Rotation-Library-0.1.0-portable-x64.exe`.

## Use

- Put the EXE in a writable folder and double-click it. No installation, administrator access, separate browser, or Node.js is required to run it.
- The first launch needs internet to download action data, icons, and guides. Successful downloads are cached for later use; publisher access restrictions can prevent downloads.
- Settings and cached content are stored in `Eorzea Rotation Library Data` beside the EXE. Move that folder with the EXE to keep your data. Share only the EXE for a fresh installation.
- Select a job, level, and encounter type. Use **Full view** to see the complete rotation. The initial interface zoom is **125%**.

## Development

After `npm ci`, run `npm start` to open the app from source. Run `npm run check` to check JavaScript syntax.
