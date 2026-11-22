# APEX DRIFT 3D

A browser-based 3D arcade racing game. Built with Vite and Three.js, with installable PWA support and Cloudflare Pages deployment.

## Project structure

```text
src/
  main.js                 Application entry point
  styles.css              Game interface and HUD styles
  audio/
    SoundEngine.js        Engine, drift, boost and music audio
  game/
    ApexDriftApp.js       Game lifecycle, menus, HUD and camera
    carCatalog.js         Vehicle specifications and paint options
    ProfileManager.js     Persistent driver XP, credits and race records
    RaceTrack.js          Circuit geometry and track environment
    Vehicle.js            Vehicle models, handling and AI driving
  network/
    MultiplayerManager.js Local browser-room synchronization
```

The game is being separated into focused modules so new systems can be developed and tested independently. The current multiplayer manager is still local-browser synchronization, not internet multiplayer.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Cloudflare Pages

- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

The current release is a single-player browser game. The multiplayer prototype is local to browser contexts and is not internet multiplayer.


## Deployment

This repository is connected to the Cloudflare Pages project `apex-drift-3d`. Pushes to `main` are configured as production deployments.
