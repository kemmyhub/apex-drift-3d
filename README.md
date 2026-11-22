# APEX DRIFT 3D

A browser-based 3D arcade racing game. Built with Vite and Three.js, with installable PWA support and Cloudflare Pages deployment.

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
