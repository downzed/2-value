# Image Editor - Electron + React + Vite

## Commands

- `yarn dev` - Run in development mode (electron-vite, port 5173)
- `yarn build` - Build for production
- `yarn start` - Run built app in production mode
- `yarn typecheck` - Run TypeScript type checking
- `yarn test` - Run vitest tests (jsdom environment, tests in `tests/`)
- `yarn package` - Package the app (electron-forge)
- `yarn make` - Create distributable (electron-forge)

## Architecture

- `src/main/` - Electron main process (Node.js)
- `src/preload/` - IPC bridge (exposes `electronAPI.openImage`, `electronAPI.saveImage`)
- `src/renderer/` - React frontend with Canvas, BottomPanel, FloatingControls, FloatingImage

## Key Implementation Details

- Dev mode loads from `http://localhost:5173`, production loads from `dist/renderer/index.html`
- Image processing uses `image-js` library
- Styling with Tailwind CSS v4 (via `@tailwindcss/vite`)
- State management via React Context + custom hook (`useImage`)
- Panel positions persisted to localStorage

## Image Processing Pipeline

1. If `threshold > 0`: Convert to greyscale
2. If `blur > 0`: Apply Gaussian blur (`sigma` = blur value)
3. If `threshold > 0`: Apply threshold (`value / 255`)
4. If `invert`: Invert colors

## Known Issues

- No debouncing on slider changes (60 filter passes/second during drag)
- No error UI (errors only in console)
- `fs.writeFileSync()` blocks main thread during save
