# Architecture & Technical Reference

## System Architecture

```
┌─────────────────────────────────────────────┐
│              Browser Application              │
├─────────────────────────────────────────────┤
│                                               │
│  React App (src/renderer/)                    │
│  ├─ hooks/                                   │
│  │  ├─ useImage + ImageContext               │
│  │  ├─ useGallery + GalleryContext           │
│  │  └─ useImageLoader                        │
│  ├─ components/shell/                        │
│  │  ├─ App                                   │
│  │  ├─ BottomPanel                           │
│  │  └─ GalleryPanel                          │
│  ├─ components/gallery/                      │
│  │  ├─ FolderContextMenu                     │
│  │  ├─ FolderPickerDialog                    │
│  │  └─ ImageContextMenu                      │
│  ├─ components/shared/                       │
│  │  ├─ Icon, PillButton, SectionHeader,      │
│  │  │  SliderRow                             │
│  ├─ components/                              │
│  │  ├─ Canvas, FloatingPanel,                │
│  │  │  FloatingControls, FloatingImage,      │
│  │  │  FloatingCounter                       │
│  ├─ utils/                                   │
│  │  ├─ fileOps.ts (FSA + <a download>)       │
│  │  └─ storage.ts (IndexedDB wrapper)        │
│  └─ constants/                               │
│                                               │
│  Web APIs used:                               │
│  ├─ <input type="file"> — file open          │
│  ├─ File System Access API — file save       │
│  ├─ IndexedDB — gallery + thumbnail storage  │
│  ├─ localStorage — recents cache             │
│  ├─ OffscreenCanvas + createImageBitmap      │
│  │  → thumbnail generation                   │
│  └─ URL.createObjectURL → blob URL thumbnails│
└─────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Image Loading Flow

```
User clicks "Open" (or Ctrl+O)
    ↓
BottomPanel.handleOpen()
    ↓
openImageFile() from fileOps.ts
    └─ creates hidden <input type="file" accept="image/*">
    ↓
User selects a file
    ↓
File object returned
    ├─ If gallery is active: FolderPickerDialog shown
    │   └─ User picks folder → galleryStore.importImage(file, folderId)
    │       ├─ Reads file blob
    │       ├─ Generates thumbnail (OffscreenCanvas + createImageBitmap)
    │       └─ Stores image metadata + blobs in IndexedDB
    └─ image loaded into editor:
        ↓
loadFromFile(file) from useImageLoader
    ├─ Guardrail: file.size ≤ MAX_FILE_BYTES
    ├─ file.arrayBuffer() → Uint8Array
    ├─ createImageBitmap(blob) → decode
    ├─ OffscreenCanvas → extract ImageData
    ├─ Build image-js Image
    ├─ Guardrail: pixels ≤ MAX_PIXELS
    └─ loadImage(image, fileName, '') → useImage context
```

### Filter Pipeline Flow

```
User drags blur/threshold slider (or uses h/j/k/l keys)
    ↓
FloatingControls onChange (debounced 150ms) / useKeyboardShortcuts
    ↓
setBlur(value) / setThreshold(value)
    ├─ Pushes current snapshot to adjustmentHistory
    └─ Clears adjustmentFuture
    ↓
useImage updates state
    ↓
Canvas.useMemo() triggered
    └─ Dependencies: [currentImage, blur, threshold, values]
    ↓
Filter chain (2-value mode):
    1. if (threshold > 0) → grey({ algorithm: 'luma709' })
    2. if (blur > 0) → gaussianBlur({ sigma: blur })
    3. if (threshold > 0) → threshold({ threshold: value/255 })
    ↓
Filter chain (3-value mode):
    1. if (threshold > 0 || values === 3) → grey({ algorithm: 'luma709' })
    2. if (blur > 0) → gaussianBlur({ sigma: blur })
    3. if (threshold > 0) → applyThreeZones(image, threshold)
       └─ lowerThreshold = max(0, threshold - UI.FILTER.THREE_ZONE_BOUNDARY)
       └─ upperThreshold = min(255, threshold + UI.FILTER.THREE_ZONE_BOUNDARY)
    ↓
writeCanvas(processed, ref)
    ↓
Canvas re-renders
```

### File Save Flow

```
User clicks "Save" (or Ctrl+S)
    ↓
BottomPanel.handleSave()
    ├─ Get canvas from previewCanvasRef
    └─ canvas.toBlob("image/png")
    ↓
saveImageFile(blob, fileName) from fileOps.ts
    ├─ showSaveFilePicker() [FSA — Chrome/Edge]
    │   ├─ User picks path
    │   └─ handle.createWritable() → write(blob) → close()
    └─ Fallback: <a download> [all browsers]
        ├─ URL.createObjectURL(blob)
        └─ programmatic click → triggers download
```

### Gallery Thumbnail Flow

```
GalleryPanel mounts / images change
    ↓
useEffect fetches thumbnail blobs from IndexedDB
    └─ galleryStore.getThumbnailBlob(imageId) for each new image
    ↓
URL.createObjectURL(thumbnailBlob)
    ↓
Stored in thumbnailUrls state map
    ↓
renderImageGrid uses thumbnailUrls[imageId] as <img src>
    ↓
On unmount or image removal: URL.revokeObjectURL()
```

---

## State Management Architecture

The app uses React Context + custom hooks for state management, split into two independent contexts:

### Image State (`ImageContext` + `useImage`)
- Manages the loaded image, filter parameters (blur, threshold, values mode), undo/redo history, timer, zoom/fit, and panel visibility
- All state lives in a single `useReducer`-like pattern via `useState` in the `useImage` hook
- History (undo/redo) stores up to 50 snapshots of `{ blur, threshold, values }`
- Panel positions persist to localStorage via `useDraggablePanel`

### Gallery State (`GalleryContext` + `useGallery`)
- Manages folder list, image list, selected folder, search query, loading/error states
- All data persisted in IndexedDB via `galleryStore` singleton
- Operations (import, move, copy, delete) go through a mutation queue (`withMutationLock`) to serialize writes

---

## Component Responsibilities

### App.tsx (`shell/App.tsx`, Root)
- **Provider:** Wraps with `ImageProvider` and `GalleryProvider`
- **Composition:** Assembles Canvas, FloatingImage, FloatingControls, FloatingCounter, BottomPanel

### BottomPanel.tsx (Status Bar + File Operations)
- **New:** Calls `newBlankCanvas()` from useImage, starting a blank drawing surface
- **Open:** Calls `openImageFile()` from fileOps, then `loadFromFile()` from useImageLoader
- **Save:** Gets canvas blob, calls `saveImageFile()` from fileOps. Enabled when `hasCanvas`
  (an open image *or* a blank canvas), disabled on a truly empty stage
- **Display:** File info, status, zoom controls, minimized panel icons
- **Keybindings:** Ctrl+N / Ctrl+O / Ctrl+S

### Blank Canvas Mode
`canvasMode` in `useImage` is `'image' | 'blank'` and decides what owns the `<canvas>`:

- **`'image'`** — `sourceImage` is set and the surface is painted by the filter worker via
  `putImageData`. Existing behaviour, unchanged.
- **`'blank'`** — `sourceImage` is `null` and the surface is a freehand drawing target.
  Every worker/`putImageData` path in `Canvas.tsx` is gated on `isBlank`, so the pipeline
  is bypassed entirely and the adjustments panel has nothing to act on.

Mechanics:

- **Sizing:** The backing store is sized to the stage (the white card), so backing store and
  CSS size are 1:1 and pointer coordinates map directly. `Canvas.tsx` reports the measured
  size up via `setViewport`; `setViewport` returns the previous state object unchanged when the
  size matches, so the measurement round-trip can't drive a render loop.
- **Strokes:** Kept in refs (`strokesRef`), never in state, so painting triggers no re-render.
  Coordinates are normalized to 0..1, which lets a window resize rescale the drawing instead of
  smearing or discarding it.
- **Incremental painting:** `onPointerMove` strokes only the new segment; a full replay happens
  only on resize or on a new canvas.
- **`blankCanvasId`:** Incremented by every `newBlankCanvas()` call. `canvasMode` alone cannot
  signal "New" pressed while *already* blank, which would otherwise keep the old drawing.
- **Pointer capture:** Taken on `pointerdown` so a drag that leaves the canvas still tracks.

Blank canvases are not importable to the gallery; undo history remains scoped to adjustments.

## Saving and exporting

- **Save** (status bar, `Ctrl+S`) writes the canvas **into the gallery**, not to disk.
  - If the active item is gallery-backed, `galleryStore.updateImageBlob` replaces that
    entry's blob, thumbnail and derived metadata **in place**, so repeated saves keep
    updating one entry instead of piling up copies.
  - Otherwise `galleryStore.importImage` creates a new entry in `Unsorted`, and the open
    item is relinked to it — which also makes it restorable.
  - The saved pixels are the **graded canvas**: filtered output for images, replayed strokes
    for blank canvases.
- **Export as...** downloads a real file, via `showSaveFilePicker` with an `<a download>`
  fallback. It exists on both menus:
  - *Gallery images* — exports the stored blob directly.
  - *Auto-folder (open) items* — re-renders offscreen, because the status bar's Save reads the
    live preview canvas, which only reflects the item currently on screen. `useExportItem`
    exposes one `renderItemToBlob` used by both Save-from-menu and Export so they cannot drift.

## Domain Layer

`src/renderer/core/` holds the domain as **plain classes with no React imports**, so it can be
unit-tested directly (`tests/unit/core/`) and reused from a command or worker.

```
core/
  types.ts          EditorState, GalleryState, OpenItem, Stroke, PanelId, …
  EditorStore.ts    open items, active item, per-item adjustments/undo,
                    zoom/panels/viewport/timer, dirty tracking
  GalleryStore.ts   gallery state + orchestration over the IndexedDB repository
  ImageProcessor.ts Worker lifecycle + latest-wins job queue
  decode.ts         pure file → image-js Image, with size limits
```

`utils/storage.ts` is the **repository** (`GalleryRepository`): it owns bytes in IndexedDB.
`core/GalleryStore.ts` owns observable state and orchestration. Keeping those apart is what lets
the state be unit-tested with no IndexedDB and no React.

`ImageProcessor` is a resource, so it is a class with `start()`/`dispose()` rather than a hook;
`useImageProcessingWorker` only wires that lifecycle to a component. Each instance owns its own
worker, which is why exporting an item uses a separate processor from the preview.

`EditorStore` is an external store: `getState()` returns an immutable `EditorState` snapshot and
`subscribe(listener)` notifies on change. `src/renderer/hooks/useImage.ts` is currently a thin
`useSyncExternalStore` binding over it, kept only so the Context wiring survives the migration.

Two invariants the class is responsible for:

1. **Strokes are never in state.** They live in a private `Map<itemId, Stroke[]>`, because painting
   must not notify subscribers and keying by id makes switching items restore the right drawing.
2. **`getState()` is referentially stable between mutations.** Every mutator returns the *identical*
   state object when nothing changed, or `useSyncExternalStore` will loop forever. `#patch()` is the
   single mutation funnel that enforces this.

### Why no Redux

Considered and rejected (recorded so the decision is revisitable):

- It inverts the OOP direction this refactor set out to take — state would become
  `(state, action) => state` reducers again.
- It would not replace `GalleryStore`: the IndexedDB/blob/thumbnail work is imperative and does not
  fit reducers, leaving two paradigms inside one store.
- It would not fix the re-render fan-out any better than a subscription seam.

`useSyncExternalStore` is React's own primitive for wrapping external mutable stores, which is
exactly what these classes are. The binding is one small file, so a library can be substituted later
without touching the domain.

## Open Items (multi-document)

`useImage` holds a list of `OpenItem`s rather than a single document. `activeItemId` selects
which one is projected onto the legacy single-document shape (`currentImage`, `blur`, ...), so
consumers outside `Canvas`/`BottomPanel` are largely unaware of the change.

```
interface OpenItem {
  id; kind: 'image' | 'blank'; label; fileName
  image: Image | null            // null for blank
  galleryImageId: string | null  // set => restorable across reloads
  dedupeKey: string | null       // identity for open-once semantics
  blur; threshold; values; showOriginal
  history; future                // undo is per item, never shared
  dirty: boolean
}
```

- **Per-item everything.** Adjustments, undo/redo and blank-canvas strokes all belong to the
  item, so switching restores exactly what you left.
- **Strokes live in `strokesByItemRef`**, a `Map<itemId, Stroke[]>` held in a ref and exposed
  through context. Keying by id means switching items restores the right drawing without
  copying, and painting still causes no re-render.
- **App-global state** is limited to zoom/fit, the timer, panel visibility and the stage
  viewport. Zoom resets to fit whenever the active item changes.
- **The Auto folder** is a *virtual* gallery folder: it is derived from the live open-items
  list, always rendered first, never persisted, and has no create/rename/delete. Because it is
  derived rather than stored it cannot drift out of sync. Selecting it lists the open items;
  clicking a tile activates that item, and right-click opens `OpenItemContextMenu`
  (Open / Save to gallery / Export as... / Close).
- **Panels are global** — opening a second image no longer closes the gallery.
- **Opening twice.** `loadImage` takes an optional `dedupeKey`/`galleryImageId`; if a clean item
  with that identity is already open it is reactivated instead of duplicated. A *dirty* item is
  never merged, so unsaved work is never silently collapsed.

### Unsaved changes and restore

- Items are marked `dirty` on adjustment changes and on stroke commit; Save clears it.
- `useUnsavedChangesGuard` registers a `beforeunload` handler while anything is dirty.
- Closing a dirty item from the widget asks for confirmation.
- `useRestoreOpenItems` persists `restorableItemIds` (gallery-backed, non-dirty) to
  `localStorage` and reopens them on load from their IndexedDB blobs. Persisting is held off
  until restoration has run, otherwise the first paint would overwrite the saved list before
  reading it. Files opened from disk and blank canvases are session-only — the browser cannot
  re-read an exported file without a permission prompt, and canvases have no bytes.

### GalleryPanel.tsx (Gallery Modal)
- **Folders only:** No external gallery/explore tab
- **IndexedDB-backed:** All gallery data stored in IndexedDB via `galleryStore`
- **Thumbnails:** Loaded as blob URLs from IndexedDB, rendered in image grid
- **Operations:** Create/rename/delete folders, import/move/copy/delete images
- **Search:** Client-side case-insensitive substring filter on file names

---

## Keyboard Shortcuts

Registered in `useKeyboardShortcuts` at the `App` level. All shortcuts use `keydown` event listeners. Input focus guard: shortcuts with printable keys (h/j/k/l) are disabled when an `<input>` or `<textarea>` is focused.

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
| `Ctrl+N` | New blank canvas (see note) |
| `Ctrl+O` | Open image |
| `Ctrl+S` | Save image |
| `h` | Decrease blur (-0.5) |
| `l` | Increase blur (+0.5) |
| `j` | Decrease threshold (-1) |
| `k` | Increase threshold (+1) |
| `Escape` | Close context menus, folder picker, back from folder view |

> **Note on `Ctrl+N`:** Chrome and Edge reserve `Ctrl+N` for "new window" and will not deliver
> it to the page in a normal tab. The shortcut works in Firefox, in Chrome's Application mode,
> and once the app is installed as a PWA. Use the **New** button for a reliable path.

Note that there are **two** shortcut registries, and the file operations are split across both:
`Ctrl+N` / `Ctrl+O` / `Ctrl+S` are registered in `BottomPanel.tsx` (they need the canvas ref and
local file state), while the panel toggles, zoom and undo/redo live in `useKeyboardShortcuts.ts`.

---

## Performance

### Memory Usage
- No Electron overhead — pure browser runtime
- Baseline: ~30-40 MB (browser + React)
- Image memory: 2-3× image size (source + processed copies)
- IndexedDB storage: browser-dependent quota (~GB)

### Bundle Composition
- React: ~200 KB (gzip: ~70 KB)
- image-js: ~180 KB (gzip: ~50 KB)
- Tailwind CSS: ~21 KB (gzip: ~5 KB)
- App code: ~60 KB (gzip: ~14 KB)
- Total: ~462 KB (gzip: ~139 KB)

### Build Times
- Cold build: ~150ms (Vite)
- HMR: ~100ms

---

## Dependency Graph

```
App.tsx
├── ImageContext → useImage → constants/ui
├── GalleryProvider → useGallery → storage.ts (galleryStore)
├── useKeyboardShortcuts
├── Canvas → useImageContext, Icon
├── FloatingControls → useImageContext, FloatingPanel
│   ├── useDraggablePanel
│   ├── Icon, PillButton, SectionHeader, SliderRow
│   └── useDebouncedCallback
├── FloatingImage → useImageContext, FloatingPanel
├── FloatingCounter → useImageContext, FloatingPanel, PillButton
└── BottomPanel → useImageContext, useGalleryContext
    ├── useImageLoader → fileOps.ts (openImageFile, saveImageFile)
    └── FolderPickerDialog

Shared: Icon, PillButton, SectionHeader, SliderRow
Hooks: useDraggablePanel, useDebouncedCallback

Dependencies:
├── react, react-dom
├── image-js
├── @vitejs/plugin-react, @tailwindcss/vite, vite
├── vitest, jsdom, @testing-library/*
└── @biomejs/biome, typescript
```

---

## Development Workflow

```bash
yarn install          # Install deps
yarn dev              # Vite dev server → http://localhost:5173
yarn build            # Vite production build → dist/
yarn test             # Vitest (jsdom)
yarn lint             # Biome
yarn typecheck        # tsc --noEmit
```

---

## Known Issues & Tech Debt

### Minor
- **Unused paths alias:** `@/*` alias in `tsconfig.json` is not consistently used
- **OffscreenCanvas availability:** Thumbnail generation uses OffscreenCanvas (Chrome 76+, Firefox 105+, Safari 16.4+)

---

## Test Coverage

Tests run via Vitest with `jsdom` environment. Coverage provider: v8 (configured in `vitest.config.ts`).

| Layer | Files | Tested | Coverage |
|-------|-------|--------|----------|
| Hooks | 7 | 6 (86%) | useImage, useImageLoader, useGallery, useDebouncedCallback, useDraggablePanel, useImageProcessingWorker |
| Components | 12 | 4 (33%) | Canvas, BottomPanel, FloatingImage, FloatingCounter |
| Utils | 2 | 0 (0%) | — |
| Gallery | 3 | 0 (0%) | — |
| Shared | 2 | 0 (0%) | — |

**Biggest gaps:** `storage.ts` (16-method IndexedDB wrapper), `GalleryPanel.tsx` (567-line complex component), `useKeyboardShortcuts.ts`, `imageConversion.ts`, `fileOps.ts`.

Generate report: `yarn test --coverage`

---

**Last Updated:** June 15, 2026
