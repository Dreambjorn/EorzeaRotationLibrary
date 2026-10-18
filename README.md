# Eorzea Rotation Library

A portable Windows app for FFXIV rotations, with all 23 combat jobs in one place.

## Using the app

1. Download `EorzeaRotationLibrary.exe` from **Releases**.
2. Put it in a folder where you can save files, then double-click it. There's nothing to install.
3. Choose your job, level, and encounter type. Use **Full view** to see the whole rotation.

The first launch needs internet to download game icons, job data, and guides. These downloads are saved locally and aren't included in the repo or EXE. The app icon is bundled.

Settings and downloads live in `Eorzea Rotation Library Data`, next to the EXE. If you move the app, take that folder too. If you're sending the app to someone else, send just the EXE.

The app starts at **125% zoom** and remembers your changes.

## Building from source

You'll need Windows and Node.js 24 or newer. Open a terminal in this folder and run:

```powershell
npm ci
npm run build
```

This creates `EorzeaRotationLibrary.exe` in this folder, replacing the previous build. A versioned copy is also saved in `dist/`.

To run from source, use `npm start`. Use `npm run check` to check JavaScript syntax.

## Creating a release

Open **Actions > Release > Run workflow** and select the branch to build.

## Credits

Guides by [Icy Veins](https://www.icy-veins.com/ffxiv/), [The Balance](https://www.thebalanceffxiv.com/), and their authors.

FFXIV data and icons © SQUARE ENIX. Additional game data from [XIVAPI](https://v2.xivapi.com/).

App icon: [Crystal shine](https://game-icons.net/1x1/lorc/crystal-shine.html) by Lorc, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Recolored blue for this app.

## Disclaimer

Guide content, downloaded action data, and job/action icons are not included in this repository or the EXE. The app downloads and caches them locally. Only the app icon is bundled.
