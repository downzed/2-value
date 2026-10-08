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
  - `components/gallery/` - FolderContextMenu, FolderPickerDialog, ImageContextMenu, OpenItemContextMenu
  - `components/shared/` - Icon, PillButton, SectionHeader, SliderRow (reusable UI primitives)
  - `components/` - Canvas, FloatingPanel (reusable), FloatingControls, FloatingImage, FloatingCounter
  - `hooks/` - useImage, ImageContext, useGallery, GalleryContext, useDraggablePanel, useDebouncedCallback, useKeyboardShortcuts, useUnsavedChangesGuard, useRestoreOpenItems
  - `utils/` - fileOps (file open/save with FSA + fallbacks), storage (IndexedDB wrapper for gallery)
  - `constants/` - UI constants (filter ranges, presets, history config, blank-canvas brush)

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
- Two shortcut registries: file ops (`Ctrl+N`/`Ctrl+O`/`Ctrl+S`) in `BottomPanel.tsx`,
  panel toggles / zoom / undo in `useKeyboardShortcuts.ts`
- `Ctrl+N` is reserved by Chrome and Edge in a normal tab and will not reach the page;
  the **New** button is the reliable trigger

## Blank Canvas Mode

`canvasMode` (`'image' | 'blank'`) in `useImage` decides what owns the `<canvas>` in
`Canvas.tsx`. In `'blank'` mode the filter worker is bypassed entirely and the surface is a
freehand drawing target.

- Backing store is sized to the stage via `setViewport`, keeping backing store and CSS 1:1
- Strokes live in refs with 0..1-normalized coords, so painting causes no re-render and a
  window resize rescales the drawing
- `blankCanvasId` increments per `newBlankCanvas()` to clear strokes even when already blank
- `hasCanvas` (image *or* blank) gates the Save button and `Ctrl+S`
- Save writes into the gallery, not to disk; downloading is `Export as...` on a gallery item menu
- Blank-canvas strokes are held in a `Map<itemId, Stroke[]>` ref exposed via context, keyed by
  item id so switching items restores the right drawing without copying

## Open Items (multi-document)

- `useImage` keeps a list of `OpenItem`s; `activeItemId` selects which is projected onto the
  legacy single-document shape, so most consumers are unaffected by the list
- The gallery shows them under a **virtual "Auto" folder** (derived, never persisted);
  no separate open-items widget exists
- Menu-driven Save/Export re-render the item offscreen so a non-active item still works
- Adjustments, undo/redo and strokes are all per-item; zoom, timer, panels and viewport are global
- Opening an already-open (and clean) source reactivates it instead of duplicating the row
- Unsaved work: `dirty` per item, `beforeunload` guard (`useUnsavedChangesGuard`), confirm on
  close, and `useRestoreOpenItems` reopening only gallery-backed clean items after a reload

## Image Processing Pipeline

### 2-value mode
1. If `threshold > 0`: Convert to greyscale (`luma709`)
2. If `blur > 0`: Apply Gaussian blur (`sigma` = blur value)
3. If `threshold > 0`: Apply binary threshold (`value / 255`)

### 3-value mode
1. Always: Convert to greyscale (`luma709`)
2. If `blur > 0`: Apply Gaussian blur (`sigma` = blur value)
3. If `threshold > 0`: Apply three-zone threshold (black/gray/white with ±`UI.FILTER.THREE_ZONE_BOUNDARY` boundaries)
