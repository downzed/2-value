# 2-value

A 2-value image editor for drawing studies. Converts images to a 2-tone or 3-tone palette using blur and threshold adjustments.

## Commands

- `yarn dev` - Run in development mode (electron-vite, port 5173)
- `yarn build` - Build for production
- `yarn start` - Run built app in production mode
- `yarn typecheck` - Run TypeScript type checking
- `yarn test` - Run vitest tests
- `yarn lint` - Run Biome linter
- `yarn format:check` - Check formatting with Biome
- `yarn package` - Package the app
- `yarn make` - Create distributable

## Features

- **Gallery/Recents**: Open images from a recent files grid or browse the filesystem
- Open images (PNG, JPG, JPEG, BMP)
- Save images as PNG or JPEG (format auto-detected from extension)
- Adjustable blur (0-10) and threshold (0-255)
- 2-value / 3-value mode toggle (binary or three-zone threshold)
- 3 adjustment presets: Sketch, High Contrast, 3-Tone
- Undo/redo for adjustments (up to 50 history depth)
- Countdown timer with presets (1m, 5m, 10m, 15m)
- Reusable floating panels with drag-and-drop positioning (persisted per panel)
- Minimized panel icons in the bottom status bar (with timer badge)
- View original vs filtered side-by-side
- Real-time filter preview

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+O` | Open image |
| `Ctrl+S` | Save image |
| `h` | Decrease blur (-0.5) |
| `l` | Increase blur (+0.5) |
| `j` | Decrease threshold (-1) |
| `k` | Increase threshold (+1) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Alt+1` | Toggle Adjustments panel |
| `Alt+2` | Toggle Original panel |
| `Alt+3` | Toggle Timer panel |

## Architecture

- `src/main/` - Electron main process (Node.js) — file dialogs, IPC handlers, recents cache
- `src/preload/` - IPC bridge (exposes `electronAPI`: openImage, saveImage, getRecents, removeRecent, openImageFromPath)
- `src/renderer/` - React frontend
  - `components/shell/` - App (AppContent pattern), BottomPanel (status bar + file ops), OpenDialog (gallery/recents modal)
  - `components/shared/` - Icon, PillButton, SectionHeader, SliderRow (reusable UI primitives)
  - `components/` - Canvas, FloatingPanel (reusable), FloatingControls, FloatingImage, FloatingCounter
  - `hooks/` - useImage, ImageContext, useDraggablePanel, useDebouncedCallback, useKeyboardShortcuts
  - `constants/` - UI constants (filter ranges, presets, history config)

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Electron 41.2.0 |
| Build Tool | electron-vite 5.0.0 + Vite 8.0.7 |
| UI Library | React 19.2.4 |
| Image Processing | image-js 1.5.0 |
| Styling | Tailwind CSS 4.2.2 |
| Language | TypeScript 6.0.2 |
| Packaging | Electron Forge 7.11.1 |
| Linting/Formatting | Biome |
| Testing | Vitest + Testing Library |
