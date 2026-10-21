# Eorzea Rotation Library

A portable Windows app for FFXIV rotations, with all 23 combat jobs in one place.

## Using the app

1. Download `EorzeaRotationLibrary.exe` from [Releases](https://github.com/Dreambjorn/EorzeaRotationLibrary/releases/latest).
2. Save it in a writable folder and double-click it. No installation needed.
3. Select your job, level, and encounter. Adjust **Your conditions** or open **Full view**.

- First launch needs internet for game data, icons, and guides.
- Settings and downloads live in `Eorzea Rotation Library Data`. Move that folder with the app.
- Blue Mage and Beastmaster include introductory setups only.

## Building from source

Requires Windows and Node.js 24 or newer. Run from this folder:

```powershell
npm ci
npm run build
```

Builds appear in this folder, with a versioned copy in `dist/`.

- Run locally: `npm start`.
- Check syntax: `npm run check`.
- Run regression tests: `npm test`.

<details>
<summary>Optional: validate downloaded rotations</summary>

Checks every job and level without changing the downloaded library:

```powershell
npm run validate:rotations -- "Eorzea Rotation Library Data/library.json"
```

</details>

## Creating a release

Open **Actions > Release > Run workflow** and select the branch to build.

## Credits

Guides by [Icy Veins](https://www.icy-veins.com/ffxiv/), [The Balance](https://www.thebalanceffxiv.com/), and their authors.

FFXIV data and icons © SQUARE ENIX. Additional game data from [XIVAPI](https://v2.xivapi.com/).

App icon: [Crystal shine](https://game-icons.net/1x1/lorc/crystal-shine.html) by Lorc, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Recolored blue for this app.

## Disclaimer

Guide content, game data, and job/action icons are downloaded and cached locally, and excluded from the repository and app bundle. Only the app icon is bundled.
