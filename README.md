# APEX DRIFT 3D

**APEX DRIFT 3D is a browser-based 3D arcade racer built with Three.js.** Pick a machine and livery, tune its performance, then race AI rivals or chase your best lap across selectable circuits. A dramatic garage interface, responsive race HUD, nitro and drift systems, and persistent driver progression give the game a high-energy motorsport feel.

## Features

- **3D arcade racing:** Drive with keyboard controls or on-screen touch controls on supported mobile layouts.
- **Three selectable cars:** Each vehicle has its own speed, acceleration, handling, and body style.
- **Paint and upgrades:** Choose a livery and spend race credits on per-car engine, handling, and nitro upgrades.
- **Race modes:** Compete against three AI opponents in Single Player or set a personal record in Time Trial.
- **Tracks:** Choose from multiple circuits and environments.
- **Drift and nitro:** Build drift points, charge nitro, and use boost during a race.
- **Driver progression:** Earn XP and credits, level up, track race records, and unlock achievement rewards.
- **Local room prototype:** Create or join a room for browser-context synchronization. This is a local prototype, not internet multiplayer.
- **Installable PWA:** The game includes a web app manifest and service worker.
- **Graphics options:** Choose a graphics preset to trade visual quality for performance.

Most profile progress, upgrades, settings, and records are saved in the browser using local storage.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Accelerate | W / ↑ | GAS |
| Brake / reverse | S / ↓ | — |
| Steer | A / ←, D / → | ◀ / ▶ |
| Drift | Space | DRIFT |
| Nitro | Shift | NITRO |
| Reset car | R | — |
| Pause / resume | P / Esc | Pause button |

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

## Production build

```bash
npm run build
npm run preview
```

The production-ready static site is generated in `dist/`.

## Project structure

```text
src/
  main.js                 Application entry point
  styles.css              Garage, menus, and race HUD styling
  audio/
    SoundEngine.js        Engine, drift, boost, and music audio
  game/
    ApexDriftApp.js       Game lifecycle, menus, HUD, and camera
    carCatalog.js         Vehicle specifications and paint options
    ProfileManager.js     Driver XP, credits, and race records
    UpgradeManager.js     Per-car engine, handling, and nitro upgrades
    AchievementManager.js Persistent race and drift achievements
    TrackCatalog.js       Selectable circuit layouts and environments
    RaceTrack.js          Circuit geometry and track environment
    Vehicle.js            Vehicle models, handling, and AI driving
  network/
    MultiplayerManager.js Local browser-room synchronization
```

## Deployment

The project uses Vite and is configured for Cloudflare Pages:

- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

Pushes to `main` are configured to trigger production deployments for the Cloudflare Pages project `apex-drift-3d`.
