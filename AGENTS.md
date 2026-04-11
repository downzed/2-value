# Image Editor - Electron + React + Vite

## Commands

- `yarn dev` - Run in development mode (electron-vite, port 5173)
- `yarn build` - Build for production
- `yarn start` - Run built app in production mode
- `yarn typecheck` - Run TypeScript type checking
- `yarn test` - Run vitest tests (jsdom environment, tests in `tests/`)
- `yarn lint` - Run Biome linter
- `yarn format:check` - Check formatting with Biome
- `yarn package` - Package the app (electron-forge)
- `yarn make` - Create distributable (electron-forge)

## Architecture

- `src/main/` - Electron main process (Node.js) — file dialogs, IPC handlers, recents cache
- `src/preload/` - IPC bridge (exposes `electronAPI`: openImage, saveImage, getRecents, removeRecent, openImageFromPath)
- `src/renderer/` - React frontend
  - `components/shell/` - App (AppContent pattern), BottomPanel (status bar + file ops), OpenDialog (gallery/recents modal)
  - `components/shared/` - Icon, PillButton, SectionHeader, SliderRow (reusable UI primitives)
  - `components/` - Canvas, FloatingPanel (reusable), FloatingControls, FloatingImage, FloatingCounter
  - `hooks/` - useImage, ImageContext, useDraggablePanel, useDebouncedCallback, useKeyboardShortcuts
  - `constants/` - UI constants (filter ranges, presets, history config)

## Key Implementation Details

- Dev mode loads from `http://localhost:5173`, production loads from `dist/renderer/index.html`
- Image processing uses `image-js` library
- Styling with Tailwind CSS v4 (via `@tailwindcss/vite`)
- State management via React Context + custom hook (`useImage`)
- Panel drag logic extracted into `useDraggablePanel` hook
- Panel positions persisted to localStorage (separate key per panel)
- File save supports JPEG/PNG based on chosen extension (async `fs.promises.writeFile`)
- OpenDialog modal for gallery/recents with thumbnail grid, browse button, error handling
- Recents cache: in-memory + JSON persistence at `app.getPath('userData')/recents.json`
- Shared UI primitives (Icon, PillButton, SectionHeader, SliderRow) used across all panels

## Image Processing Pipeline

### 2-value mode
1. If `threshold > 0`: Convert to greyscale (`luma709`)
2. If `blur > 0`: Apply Gaussian blur (`sigma` = blur value)
3. If `threshold > 0`: Apply binary threshold (`value / 255`)

### 3-value mode
1. Always: Convert to greyscale (`luma709`)
2. If `blur > 0`: Apply Gaussian blur (`sigma` = blur value)
3. If `threshold > 0`: Apply three-zone threshold (black/gray/white with ±`UI.FILTER.THREE_ZONE_BOUNDARY` boundaries)

