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
- **Open:** Calls `openImageFile()` from fileOps, then `loadFromFile()` from useImageLoader
- **Save:** Gets canvas blob, calls `saveImageFile()` from fileOps
- **Display:** File info, status, zoom controls, minimized panel icons
- **Keybindings:** Ctrl+O / Ctrl+S

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
| `Ctrl+O` | Open image |
| `Ctrl+S` | Save image |
| `h` | Decrease blur (-0.5) |
| `l` | Increase blur (+0.5) |
| `j` | Decrease threshold (-1) |
| `k` | Increase threshold (+1) |
| `Escape` | Close context menus, folder picker, back from folder view |

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
