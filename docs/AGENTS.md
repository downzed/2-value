# Image Editor - Vite + React

## Commands

- `yarn dev` - Run in development mode (Vite dev server, port 5173)
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn typecheck` - Run TypeScript type checking
- `yarn test` - Run vitest tests (jsdom environment, tests in `tests/`)
- `yarn lint` - Run Biome linter
- `yarn format:check` - Check formatting with Biome

## Architecture

- `src/renderer/` - React frontend
  - `components/shell/` - App (AppContent pattern), BottomPanel (status bar + file ops), GalleryPanel (gallery modal)
  - `components/gallery/` - FolderContextMenu, FolderPickerDialog, ImageContextMenu
  - `components/shared/` - Icon, PillButton, SectionHeader, SliderRow (reusable UI primitives)
  - `components/` - Canvas, FloatingPanel (reusable), FloatingControls, FloatingImage, FloatingCounter
  - `hooks/` - useImage, ImageContext, useGallery, GalleryContext, useDraggablePanel, useDebouncedCallback, useKeyboardShortcuts
  - `utils/` - fileOps (file open/save with FSA + fallbacks), storage (IndexedDB wrapper for gallery)
  - `constants/` - UI constants (filter ranges, presets, history config)

## Key Implementation Details

- Image processing uses `image-js` library
- Styling with Tailwind CSS v4 (via `@tailwindcss/vite`)
- State management via React Context + custom hook (`useImage`)
- Panel drag logic extracted into `useDraggablePanel` hook
- Panel positions persisted to localStorage (separate key per panel)
- File open via `<input type="file" accept="image/*">`
- File save via File System Access API (`showSaveFilePicker`) with `<a download>` fallback
- Gallery images stored in IndexedDB (blobs for full images + thumbnails, metadata in separate stores)
- Thumbnails generated client-side via OffscreenCanvas + createImageBitmap
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
