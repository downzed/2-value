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
    └─ reset blur/threshold/values/showOriginal/counter/panels/history
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
type PanelId = 'controls' | 'original' | 'timer';

interface AdjustmentSnapshot {
  blur: number;
  threshold: number;
  values: 2 | 3;
}

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

  // Panel visibility
  panels: Record<PanelId, boolean>, // true = open, false = minimized

  // Undo/redo
  adjustmentHistory: AdjustmentSnapshot[], // Past states (stack, max 50)
  adjustmentFuture: AdjustmentSnapshot[],  // Redo stack
}
```

### State Flow

```
App.tsx
└── ImageProvider (Context)
    └── AppContent
        ├── useKeyboardShortcuts() — global keybinds (h/j/k/l, Ctrl+Z/Shift+Z, Alt+1/2/3)
        └── useImage hook
            └── [ImageState] ← Central state
                ├─ Canvas (reads: currentImage, blur, threshold, values, showOriginal)
                ├─ BottomPanel (reads: fileName, hasImage, panels, counter, counterRunning, counterDuration)
                │   └─ Renders minimized panel icons when !panels[id]
                ├─ FloatingControls → FloatingPanel
                │   (reads: all adjustments, canUndo, canRedo, panels.controls)
                │   (writes: setBlur, setThreshold, setValues, resetControls, applyPreset, undo, redo)
                ├─ FloatingImage → FloatingPanel
                │   (reads: originalImage, showOriginal, panels.original)
                │   (writes: toggleShowOriginal, setPanel)
                ├─ FloatingCounter → FloatingPanel
                │   (reads: counter, counterRunning, counterDuration, panels.timer)
                │   (writes: startCounter, stopCounter, setPanel)
                └── [setters]
                    ├─ setBlur          (+ history push)
                    ├─ setThreshold     (+ history push)
                    ├─ setValues        (+ history push)
                    ├─ applyPreset      (+ history push, single entry)
                    ├─ toggleShowOriginal
                    ├─ loadImage        (clears history)
                    ├─ resetImage       (clears history)
                    ├─ resetControls    (clears history)
                    ├─ undo / redo
                    ├─ togglePanel / setPanel
                    ├─ startCounter
                    └─ stopCounter
```

---

## Component Responsibilities

### App.tsx (Root)
- **Provider:** Wraps with `ImageProvider`
- **AppContent pattern:** Inner component calls `useKeyboardShortcuts()` inside the provider context
- **Composition:** Assembles all components (Canvas, FloatingImage, FloatingControls, FloatingCounter, BottomPanel)

### Canvas.tsx (Main Preview)
- **Input:** currentImage, blur, threshold, values, showOriginal from context
- **Output:** Canvas element with filtered preview
- **Effect:** Recalculates filters on prop changes using useMemo
- **Performance:** Full reprocessing on every change
- **2-value mode:** grey → blur → threshold (binary)
- **3-value mode:** grey (always) → blur → threeZones (black/gray/white, boundaries from `UI.FILTER.THREE_ZONE_BOUNDARY`)

### FloatingPanel.tsx (Reusable Panel Shell)
- **Props:** `title`, `storageKey`, `defaultPosition`, `isOpen`, `onClose`, `titleBarActions?`, `panelStyle?`, `zClass?`, `children`
- **Title bar:** Drag handle (`⋮⋮`), title text, optional action buttons, close button
- **Drag:** Uses `useDraggablePanel` internally — consumers don't set up refs or drag handling
- **Closed state:** Returns `null` (minimized icon rendered by BottomPanel, not by this component)
- **No default padding:** Consumers control their own padding via children

### FloatingControls.tsx (Adjustment Panel)
- **Uses:** FloatingPanel wrapper
- **Sections:** Presets, Adjustments, History (visually separated with dividers and section headers)
- **Presets:** 3 presets from `UI.PRESETS` (Sketch, High Contrast, 3-Tone) — active preset highlighted
- **Adjustments:** Blur slider (0-10, step 0.5), Threshold slider (0-255), 2/3 value toggle, Reset button
- **History:** Undo/Redo buttons with `Ctrl+Z`/`Ctrl+Shift+Z` tooltips
- **Debounced sliders:** Local state + `useDebouncedCallback` (150ms) for blur/threshold
- **Constants:** Uses `UI.FILTER.*` and `UI.PRESETS` from `constants/ui.ts`
- **Auto-open:** Opens panel when `hasImage` becomes true

### FloatingImage.tsx (Original Preview)
- **Uses:** FloatingPanel wrapper
- **Display:** Unfiltered image thumbnail via canvas
- **Toggle:** Show original/processed eye button as `titleBarActions`
- **Auto-open:** Opens panel when `originalImage` changes
- **Re-render:** Re-renders canvas when panel reopens (unmounted while closed)

### FloatingCounter.tsx (Countdown Timer)
- **Uses:** FloatingPanel wrapper
- **Presets:** 1m, 5m, 10m, 15m buttons (local `PRESETS` constant, not `UI.PRESETS`)
- **Display:** Countdown timer (MM:SS or SS format)
- **Controls:** Start/Stop toggle, Reset button
- **Behavior:** Auto-stops when counter reaches 0

### BottomPanel.tsx (Status Bar + File Operations)
- **Open:** File dialog → image loading (Ctrl+O)
- **Save:** Canvas → file system, async write (Ctrl+S)
- **Display:** File info (name, dimensions), status (ready/loading/loaded/saving/saved/error)
- **Minimized panel icons:** Right side, left of status indicator. Only shown when a panel is closed. Clicking reopens the panel.
  - Controls icon: sliders SVG
  - Original icon: image/photo SVG
  - Timer icon: clock SVG + badge showing remaining time when timer is running

---

## Keyboard Shortcuts Architecture

### useKeyboardShortcuts.ts (Global Hook)

Registered once in `AppContent` (inside `ImageProvider`). Handles:
- **Vim-style adjustments:** `h`/`l` (blur ±0.5), `j`/`k` (threshold ±1) — only when `hasImage`, no modifiers, not focused on input
- **Undo/Redo:** `Ctrl+Z` / `Ctrl+Shift+Z`
- **Panel toggles:** `Alt+1`/`Alt+2`/`Alt+3`

### BottomPanel inline shortcuts

`Ctrl+O` (open) and `Ctrl+S` (save) remain in BottomPanel's own `useEffect` because they depend on local state (`status`, `previewCanvasRef`).

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

Undo/Redo:
  ├─ Each AdjustmentSnapshot: ~24 bytes (3 numbers)
  ├─ Max depth: 50
  = ~1.2 KB max (negligible)
```

### CPU Usage During Interaction

```
Idle:
  └─ CPU: ~1-2%

Dragging Blur Slider:
  ├─ onChange events: 60/sec (60 fps)
  ├─ Debounced to setBlur: ~6/sec (150ms debounce)
  ├─ Filter passes per setBlur: 2-3 filters
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
│       └── constants/ui.ts (UI.FILTER.*, UI.PRESETS, UI.HISTORY.*)
├── useKeyboardShortcuts.ts (called in AppContent)
│   ├── useImageContext
│   └── constants/ui.ts
├── Canvas.tsx
│   ├── useImageContext
│   ├── writeCanvas (from image-js)
│   └── useMemo
├── FloatingControls.tsx
│   ├── useImageContext
│   ├── FloatingPanel.tsx
│   │   └── useDraggablePanel.ts
│   ├── useDebouncedCallback.ts
│   └── constants/ui.ts (UI.FILTER.*, UI.PRESETS)
├── FloatingImage.tsx
│   ├── useImageContext
│   ├── FloatingPanel.tsx
│   │   └── useDraggablePanel.ts
│   └── writeCanvas (from image-js)
├── FloatingCounter.tsx
│   ├── useImageContext
│   └── FloatingPanel.tsx
│       └── useDraggablePanel.ts
└── BottomPanel.tsx
    ├── useImageContext (panels, setPanel, counter, counterRunning, counterDuration)
    ├── readImg (from image-js)
    └── window.electronAPI
        ├── openImage (IPC)
        └── saveImage (IPC)

Shared Hooks:
├── useDraggablePanel.ts (used internally by FloatingPanel)
└── useDebouncedCallback.ts (used by FloatingControls)

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
Drag Slider → onChange (60x/sec) → debounce (150ms) → setBlur() →
useMemo triggered → gaussianBlur() → writeCanvas() → Canvas render
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
- Context isolation: true
- Node integration: false
- Sandbox: false (noted as intentional)
- Preload bridge pattern used
- No eval() in app code
- CSP headers configured

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
1. ~~Extract `useDraggablePanel()` hook~~ Done
2. ~~Replace fs.writeFileSync() with async~~ Done
3. ~~Extract magic numbers to constants~~ Done (`UI.FILTER.THREE_ZONE_BOUNDARY`)
4. ~~Remove unused debounce utility~~ Done
5. ~~Remove unused toast system~~ Done
6. ~~Fix `resetControls` not clearing interval~~ Done
7. ~~Add debounce to sliders (performance)~~ Done (`useDebouncedCallback`)
8. ~~Add panel bounds checking~~ Done (`useDraggablePanel`)
9. ~~Add keyboard shortcuts (Ctrl+O, Ctrl+S)~~ Done
10. ~~Reusable FloatingPanel component~~ Done
11. ~~Remove FABs, minimize to bottom bar~~ Done
12. ~~Presets system (Sketch, High Contrast, 3-Tone)~~ Done
13. ~~Undo/redo for adjustments~~ Done
14. ~~Vim-style keybinds (h/j/k/l) + panel toggles (Alt+1/2/3)~~ Done

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
