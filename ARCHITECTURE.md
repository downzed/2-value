# Architecture & Technical Reference

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐   │
│  │ Main Process   │  │  Preload Bridge│  │ Renderer     │   │
│  │ (Node.js)      │  │ (Context IPC)  │  │ (React App)  │   │
│  ├────────────────┤  ├────────────────┤  ├──────────────┤   │
│  │ App Lifecycle  │  │ electronAPI    │  │ UI Components│   │
│  │ IPC Handlers   │  │ ├─ openImage   │  │ ├─ Canvas    │   │
│  │ ├─ open-image  │  │ └─ saveImage   │  │ ├─ Controls  │   │
│  │ └─ save-image  │  │                │  │ └─ Floating  │   │
│  │ File System    │  │ Security      │  │   Panels     │   │
│  │ nativeImage    │  │ ├─ contextIsolation          │   │
│  │ Conversion     │  │ ├─ sandboxed: false          │   │
│  └────────────────┘  │ └─ nodeIntegration: false    │   │
│         │             └────────────────┘  │
│         │                    ▲            │
│         └────────────────────┼────────────┘
│                              │ IPC Bridge
│  ┌──────────────────────────┴─────────────────────┐
│  │         Native Electron APIs                   │
│  ├────────────────────────────────────────────────┤
│  │ • dialog.showOpenDialog()                      │
│  │ • dialog.showSaveDialog()                      │
│  │ • nativeImage                                  │
│  │ • shell.openExternal()                         │
│  │ • fs (Node.js filesystem)                      │
│  └────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Image Loading Flow

```
User clicks "Open"
    ↓
BottomPanel.handleOpen()
    ↓
window.electronAPI.openImage()
    ↓
[IPC Boundary]
    ↓
Main Process: ipcMain.handle("open-image")
    ├─ dialog.showOpenDialog()
    ├─ nativeImage.createFromPath()
    └─ image.toDataURL()
    ↓
[IPC Return]
    ↓
BottomPanel receives result
    ├─ Create window.Image from dataURL
    ├─ readImg() → image-js Image instance
    └─ loadImage(imageInstance, fileName)
    ↓
useImage.ts: setImageState()
    ├─ currentImage = image.clone()
    ├─ originalImage = image.clone()
    └─ reset blur/threshold/values/showOriginal/counter
    ↓
ImageContext updates
    ↓
Canvas component receives currentImage
    ├─ Apply filter effects (2-value or 3-value mode)
    ├─ writeCanvas() to ref
    └─ Re-render preview
    ↓
FloatingImage receives originalImage
    ├─ writeCanvas() to preview
    └─ Show toggle button in header
```

### Filter Pipeline Flow

```
User drags blur/threshold slider
    ↓
FloatingControls onChange
    ↓
setBlur(value) / setThreshold(value)
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
       └─ < lower → black (0), > upper → white (255), else → gray (128)
    ↓
writeCanvas(processed, ref)
    ↓
Canvas re-renders
```

### File Save Flow

```
User clicks "Save"
    ↓
BottomPanel.handleSave()
    ├─ Get canvas from previewCanvasRef
    └─ toDataURL("image/png")
    ↓
window.electronAPI.saveImage(dataUrl)
    ↓
[IPC Boundary]
    ↓
Main Process: ipcMain.handle("save-image")
    ├─ dialog.showSaveDialog() [UI blocks here]
    ├─ nativeImage.createFromDataURL(dataUrl)
    ├─ image.toPNG()
    └─ fs.promises.writeFile() [async, non-blocking]
    ↓
[IPC Return: filePath]
    ↓
BottomPanel receives success
```

---

## State Management Architecture

### State Structure

```typescript
ImageState = {
  // Image data
  currentImage: Image | null,      // After filters
  originalImage: Image | null,     // Unmodified
  fileName: string,

  // Filter values
  blur: number,                    // 0-10
  threshold: number,               // 0-255
  values: 2 | 3,                  // 2-value or 3-value mode
  showOriginal: boolean,           // Toggle processed/original preview

  // Counter (countdown timer)
  counter: number,                 // Seconds remaining
  counterRunning: boolean,         // Timer active
  counterDuration: number | null,  // Selected duration
}
```

### State Flow

```
App.tsx
└── ImageProvider (Context)
    └── useImage hook
        └── [ImageState] ← Central state
            ├─ Canvas (reads: currentImage, blur, threshold, values, showOriginal)
            ├─ BottomPanel (reads: fileName, currentImage, hasImage)
            ├─ FloatingControls (reads: all; writes: setBlur, setThreshold, setValues, resetControls)
            ├─ FloatingImage (reads: originalImage, showOriginal, toggleShowOriginal)
            ├─ FloatingCounter (reads: counter, counterRunning, counterDuration; writes: startCounter, stopCounter)
            └── [setters]
                ├─ setBlur
                ├─ setThreshold
                ├─ setValues
                ├─ toggleShowOriginal
                ├─ loadImage
                ├─ resetImage
                ├─ resetControls
                ├─ startCounter
                └─ stopCounter
```

---

## Component Responsibilities

### Canvas.tsx (Main Preview)
- **Input:** currentImage, blur, threshold, values, showOriginal from context
- **Output:** Canvas element with filtered preview
- **Effect:** Recalculates filters on prop changes using useMemo
- **Performance:** Full reprocessing on every change
- **2-value mode:** grey → blur → threshold (binary)
- **3-value mode:** grey (always) → blur → threeZones (black/gray/white, boundaries from `UI.FILTER.THREE_ZONE_BOUNDARY`)

### FloatingControls.tsx (Adjustment Panel)
- **Drag:** Position persistence via localStorage (uses `useDraggablePanel` hook)
- **UI:** Blur slider (0-10, step 0.5), Threshold slider (0-255), 2/3 value toggle, Reset button
- **Constants:** Uses `UI.FILTER.*` from `constants/ui.ts` for slider ranges and zone boundaries

### FloatingImage.tsx (Original Preview)
- **Display:** Unfiltered image thumbnail
- **Drag:** Position persistence via localStorage (uses `useDraggablePanel` hook)
- **Toggle:** Show original/processed button in header with tooltip

### FloatingCounter.tsx (Countdown Timer)
- **Presets:** 1m, 5m, 10m, 15m buttons
- **Display:** Countdown timer (MM:SS or SS format)
- **Controls:** Start/Stop toggle, Reset button
- **Badge:** When minimized, shows remaining time as badge on icon
- **Behavior:** Auto-stops when counter reaches 0
- **Drag:** Position persistence via localStorage (uses `useDraggablePanel` hook)

### BottomPanel.tsx (File Operations)
- **Open:** File dialog → image loading
- **Save:** Canvas → file system (async write)
- **Display:** File info (name, dimensions), status (ready/loading/loaded/saving/saved/error)

### App.tsx (Root)
- **Provider:** Wraps with ImageProvider
- **Composition:** Assembles all components (Canvas, FloatingImage, FloatingControls, FloatingCounter, BottomPanel)

---

## Performance Characteristics

### Memory Usage Profile

```
Baseline:
  ├─ Electron + V8: ~60 MB
  └─ React runtime: ~20-30 MB
  = ~80-90 MB idle

With Image:
  ├─ Original image file: N bytes
  ├─ originalImage clone: ~N bytes
  ├─ currentImage (before filter): ~N bytes
  ├─ currentImage (after filter): ~N bytes [during processing]
  = 2-3× image size overhead

Example (10MP photo):
  ├─ File: ~8 MB
  ├─ Memory usage: 80 MB baseline + 16-24 MB image
  = ~96-104 MB total
```

### CPU Usage During Interaction

```
Idle:
  └─ CPU: ~1-2%

Dragging Blur Slider:
  ├─ onChange events: 60/sec (60 fps)
  ├─ Filter passes: 60 × 4 filters = 240/sec
  ├─ gaussianBlur(): Most expensive
  ├─ Canvas update: ~16ms per frame
  └─ CPU: ~30-50% (noticeable on large images)
```

### Build Times

```
Cold Build:
  ├─ Main: 19ms
  ├─ Preload: 9ms
  └─ Renderer: 145ms (572 modules)
  = 173ms total

Incremental (TSX change):
  ├─ Renderer HMR: ~100ms
  = Fast iteration

Bundle Composition:
  ├─ React: 600 KB
  ├─ image-js: 500 KB
  ├─ Tailwind (included): 16.89 KB CSS
  ├─ App code: ~50 KB
  └─ Total: 1.1 MB (compressed ~400 KB)
```

---

## Dependency Graph

```
App.tsx
├── ImageContext.tsx
│   └── useImage.ts
├── Canvas.tsx
│   ├── useImageContext
│   ├── writeCanvas (from image-js)
│   └── useMemo
├── FloatingControls.tsx
│   ├── useImageContext
│   ├── useDraggablePanel
│   └── constants/ui.ts (UI.FILTER.*)
├── FloatingImage.tsx
│   ├── useImageContext
│   ├── writeCanvas (from image-js)
│   └── useDraggablePanel
├── FloatingCounter.tsx
│   ├── useImageContext
│   └── useDraggablePanel
└── BottomPanel.tsx
    ├── useImageContext
    ├── readImg (from image-js)
    └── window.electronAPI
        ├── openImage (IPC)
        └── saveImage (IPC)

Shared Hooks:
└── useDraggablePanel.ts (used by FloatingControls, FloatingImage, FloatingCounter)

External Dependencies:
├── react@19.2.4
├── react-dom@19.2.4
├── image-js@1.5.0
└── electron@41.2.0 (main/preload only)

Dev Dependencies:
├── @vitejs/plugin-react
├── @tailwindcss/vite
├── electron-vite@5.0.0
├── vite@8.0.7
├── typescript@6.0.2
├── vitest (test runner)
├── @testing-library/react (test utilities)
└── biome (linter + formatter)
```

---

## Critical Paths & Bottlenecks

### Path 1: Image Loading (User Perspective)
```
Click Open → Dialog (user interaction) → IPC → File read → 
window.Image creation → readImg() → Canvas redraw
Total Time: ~500-1000ms (mostly user interaction + file I/O)
Bottleneck: File I/O and image decoding
```

### Path 2: Filter Application (User Perspective)
```
Drag Slider → onChange (60x/sec) → setBlur() → useEffect triggered →
gaussianBlur() → writeCanvas() → Canvas render
Total Time: ~16-30ms per frame
Bottleneck: gaussianBlur() calculation (most expensive filter)
```

### Path 3: File Save (User Perspective)
```
Click Save → Dialog (user interaction) → canvas.toDataURL() →
IPC → nativeImage creation → PNG encoding →
fs.promises.writeFile() [async] → Return
Total Time: ~1-5s (depends on image size and disk)
```

---

## Configuration Files Reference

### electron.vite.config.ts (Authoritative)
```typescript
defineConfig({
  main: { /* Node.js entry */ },
  preload: { /* IPC bridge entry */ },
  renderer: { /* React app entry - uses tailwindcss + react plugins */ }
})
```

### tsconfig.json
```typescript
{
  target: "ES2020",
  strict: true,
  jsx: "react-jsx",
  paths: { "@/*": ["src/*"] }  // Not consistently used
}
```

### biome.json
```json
{
  formatter: { jsxQuoteStyle: "single", quoteStyle: "single", lineWidth: 120 },
  linter: { enabled: true, rules: { recommended: true } }
}
```

### vitest.config.ts
```typescript
{
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"]
  }
}
```

---

## Security Model

### Process Isolation
```
┌─ Main Process (Full Node.js Access)
│  └─ Can access filesystem, system APIs
│
├─ Preload Script (Limited Bridge)
│  └─ Exposes only: openImage, saveImage
│
└─ Renderer Process (Sandboxed - conceptually)
   ├─ No direct filesystem access
   ├─ No direct system access
   └─ IPC → Main Process required
```

### IPC Interface
```typescript
window.electronAPI = {
  openImage: () → Promise<{dataUrl, path}>,
  saveImage: (dataUrl) → Promise<filePath>
}
```

### Security Features
- ✅ Context isolation: true
- ✅ Node integration: false
- ⚠️ Sandbox: false (noted as intentional)
- ✅ Preload bridge pattern used
- ✅ No eval() in app code
- ✅ CSP headers configured

---

## Development Workflow

### Local Dev Setup
```bash
yarn install                    # Install deps
yarn dev                        # Runs electron-vite with dev server
                               # Vite loads from http://localhost:5173
                               # DevTools auto-opened
                               # HMR enabled for fast iteration
```

### Build Process
```bash
yarn build                      # electron-vite build
                               # Outputs to:
                               # ├─ dist/main/index.mjs
                               # ├─ dist/preload/index.mjs
                               # └─ dist/renderer/index.html + assets
```

### Production Run
```bash
yarn start                      # Uses electron-forge
                               # Loads from dist/ (built files)
```

---

## Known Issues & Tech Debt

### Minor
- **Unused paths alias:** `@/*` alias in `tsconfig.json` is not consistently used

---

## Future Optimization Opportunities

### Short Term
1. ~~Extract `useDraggablePanel()` hook~~ ✅ Done
2. ~~Replace fs.writeFileSync() with async~~ ✅ Done
3. ~~Extract magic numbers to constants~~ ✅ Done (`UI.FILTER.THREE_ZONE_BOUNDARY`)
4. ~~Remove unused debounce utility~~ ✅ Done
5. ~~Remove unused toast system~~ ✅ Done
6. ~~Fix `resetControls` not clearing interval~~ ✅ Done
7. ~~Add debounce to sliders (performance)~~ ✅ Done (`useDebouncedCallback`)
8. ~~Add panel bounds checking~~ ✅ Done (`useDraggablePanel`)
9. ~~Add keyboard shortcuts (Ctrl+O, Ctrl+S)~~ ✅ Done

### Medium Term (1 month)
1. Add component-level test coverage (Canvas, FloatingImage, FloatingCounter, BottomPanel)
2. Profile with large images
3. Consider web worker for filters

### Long Term (1+ quarter)
1. Implement incremental filter updates
2. Optimize bundle size (tree-shake image-js)
3. Consider alternative image processing library
4. Re-enable sandbox (if possible)

---

**Last Updated:** April 10, 2026
