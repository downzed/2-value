# 2-value

A value image editor for drawing studies. Converts images to a 2-tone or 3-tone palette using blur and threshold adjustments.

## Commands

- `yarn dev` - Run in development mode (Vite dev server, port 5173)
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn typecheck` - Run TypeScript type checking
- `yarn test` - Run vitest tests
- `yarn lint` - Run Biome linter
- `yarn format:check` - Check formatting with Biome

## Features

- **Gallery**: Self-contained image management system with folder organization, local import
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
| `Ctrl+1` / `Alt+1` | Toggle controls panel |
| `Ctrl+2` / `Alt+2` | Toggle original panel |
| `Ctrl+3` / `Alt+3` | Toggle timer panel |
| `Ctrl+4` / `Alt+4` | Toggle gallery panel |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+0` | Fit to view |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+O` | Open image |
| `Ctrl+S` | Save image |
| `h` | Decrease blur (-0.5) |
| `l` | Increase blur (+0.5) |
| `j` | Decrease threshold (-1) |
| `k` | Increase threshold (+1) |
| `Escape` | Close context menus, folder picker, back from folder view |

## Architecture

- `src/renderer/` - React frontend (pure browser app, no Electron)
  - `components/shell/` - App (AppContent pattern), BottomPanel (status bar + file ops), GalleryPanel (gallery modal)
  - `components/gallery/` - FolderContextMenu, FolderPickerDialog, ImageContextMenu
  - `components/shared/` - Icon, PillButton, SectionHeader, SliderRow (reusable UI primitives)
  - `components/` - Canvas, FloatingPanel (reusable), FloatingControls, FloatingImage, FloatingCounter
  - `hooks/` - useImage, ImageContext, useGallery, GalleryContext, useDraggablePanel, useDebouncedCallback, useKeyboardShortcuts
  - `utils/` - fileOps (file open/save with FSA + fallback), storage (IndexedDB wrapper)
  - `constants/` - UI constants (filter ranges, presets, history config)

## Tech Stack

| Category | Technology |
|----------|------------|
| Platform | Browser (Chrome, Firefox, Safari 16.4+) |
| Build Tool | Vite 8.0.7 |
| UI Library | React 19.2.4 |
| Image Processing | image-js 1.5.0 |
| Styling | Tailwind CSS 4.2.2 |
| Language | TypeScript 6.0.2 |
| Linting/Formatting | Biome |
| Testing | Vitest + Testing Library |
