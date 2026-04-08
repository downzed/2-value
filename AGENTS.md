# Image Editor - Electron + React + Vite

## Commands

- `yarn dev` - Run in development mode (electron-vite, port 5173)
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn start` - Run built app in production mode
- `yarn typecheck` - Run TypeScript type checking

No tests configured.

## Architecture

- `src/main/` - Electron main process (Node.js)
- `src/preload/` - IPC bridge (exposes `electronAPI.openImage`, `electronAPI.saveImage`)
- `src/renderer/` - React frontend with Canvas, BottomPanel, FloatingControls, FloatingImage

## Key Implementation Details

- Dev mode loads from `http://localhost:5173`, production loads from `dist/renderer/index.html`
- Main process has GPU disabled via `disable-gpu` and `disable-software-rasterizer` switches
- Image processing uses `image-js` library
- Styling with Tailwind CSS v4 (via `@tailwindcss/vite`)
