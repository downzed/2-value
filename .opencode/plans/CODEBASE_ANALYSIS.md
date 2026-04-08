# Electron + React + Vite Image Editor - Codebase Analysis

**Date:** April 8, 2026  
**Total Lines of Source Code:** 915  
**Build Output Size:** 1.1 MB  
**Node Modules Size:** 626 MB

---

## 1. PROJECT STRUCTURE OVERVIEW

### Directory Organization
```
2-value/
├── src/
│   ├── main/              # Electron main process (Node.js)
│   │   └── index.ts       # 103 lines - App lifecycle & IPC handlers
│   ├── preload/           # IPC bridge
│   │   └── index.ts       # 9 lines - Context isolation bridge
│   └── renderer/          # React frontend
│       ├── components/    # UI components
│       │   ├── App.tsx    # 26 lines - Root component
│       │   ├── Canvas.tsx # 84 lines - Image preview with filters
│       │   ├── BottomPanel.tsx    # 90 lines - File ops & metadata
│       │   ├── FloatingControls.tsx  # 247 lines - Adjustment panel
│       │   └── FloatingImage.tsx     # 193 lines - Original image preview
│       ├── hooks/         # Custom hooks
│       │   ├── ImageContext.tsx    # 41 lines - Context definition
│       │   └── useImage.ts         # 95 lines - Image state management
│       ├── index.tsx      # 13 lines - React root
│       ├── index.html     # 17 lines - HTML entry
│       ├── styles.css     # 12 lines - Global styles
│       └── global.d.ts    # 14 lines - Type definitions
├── dist/                  # Build output
│   ├── main/             # ~8 KB compiled
│   ├── preload/          # ~0.5 KB compiled
│   └── renderer/         # ~1.1 MB compiled
├── electron.vite.config.ts   # Electron-specific config
├── vite.config.ts           # Legacy Vite config (may be unused)
├── tsconfig.json
├── package.json
└── biome.json            # Code formatting rules
```

### Key Technology Stack
- **Runtime:** Electron 41.2.0, Node.js 18+
- **Build Tool:** Vite 8.0.7 + electron-vite 5.0.0
- **UI Framework:** React 19.2.4
- **Styling:** Tailwind CSS v4 + PostCSS
- **Image Processing:** image-js 1.5.0
- **Code Quality:** Biome (formatter only, no linting)
- **TypeScript:** 6.0.2 (strict mode enabled)

---

## 2. KEY FILES AND THEIR PURPOSES

### Main Process (`src/main/index.ts` - 103 lines)
**Purpose:** Electron application lifecycle and native OS interactions

**Key Responsibilities:**
- Window creation with security settings (contextIsolation, sandbox disabled)
- Dev server vs. production HTML loading logic
- Two IPC handlers:
  - `open-image`: File open dialog → nativeImage → dataURL
  - `save-image`: dataURL → nativeImage → PNG file write

**Security Observations:**
- ✅ Context isolation enabled
- ✅ Node integration disabled
- ⚠️ Sandbox disabled (known intentional choice)
- ✅ Uses preload bridge for IPC

**Performance Observations:**
- Uses synchronous `fs.writeFileSync()` for image saving (blocks main thread)
- nativeImage conversion adds overhead vs. canvas blob methods

---

### Preload Bridge (`src/preload/index.ts` - 9 lines)
**Purpose:** Secure IPC bridge between renderer and main processes

**Key Responsibilities:**
- Exposes `electronAPI.openImage()` and `electronAPI.saveImage()`
- Uses require (CommonJS) instead of ES imports

**Issues:**
- ⚠️ Uses `require()` instead of ES modules (inconsistent with codebase)
- ⚠️ Minimal error handling for IPC invocations

---

### Image State Management (`src/renderer/hooks/useImage.ts` - 95 lines)
**Purpose:** Central image state management via custom React hook

**State Structure:**
```typescript
{
  currentImage: Image | null,
  originalImage: Image | null,
  fileName: string,
  blur: number,        // 0-10
  threshold: number,   // 0-255
  invert: boolean
}
```

**Key Methods:**
- `loadImage()` - Clones image for both current and original
- `resetImage()` - Clears all state
- `resetControls()` - Resets adjustments only

**Performance Issues:**
- ⚠️ `.clone()` creates full image copy (expensive for large images)
- ⚠️ Two identical clones on every image load
- ✅ Uses `useCallback` for memoization (good)

---

### Image Context (`src/renderer/hooks/ImageContext.tsx` - 41 lines)
**Purpose:** React Context wrapper around `useImage` hook

**Issues:**
- Minimal logic; mostly plumbing
- Could be simplified or combined with useImage

---

### Canvas Component (`src/renderer/components/Canvas.tsx` - 84 lines)
**Purpose:** Main image preview with filter pipeline

**Filter Pipeline:**
```
1. Grey (if threshold > 0)
2. Gaussian blur (if blur > 0)
3. Threshold (if threshold > 0)
4. Invert (if enabled)
```

**Performance Issues:**
- ⚠️ Effects chain runs on EVERY prop change (blur, threshold, invert)
- ⚠️ Reprocessing creates NEW Image instances every frame
- ⚠️ No debouncing on slider changes (runs 30-60 fps while dragging)
- ⚠️ Grey conversion + threshold always applied when threshold > 0 (even if blur disabled)
- ⚠️ Dependencies array is overly broad (`[currentImage, blur, threshold, invert, previewCanvasRef]`)

**Optimization Opportunity:**
- Could use `useMemo` or external web worker for expensive operations
- Could apply filters incrementally instead of full reprocess

---

### Bottom Panel (`src/renderer/components/BottomPanel.tsx` - 90 lines)
**Purpose:** File operations (open/save) and metadata display

**Key Methods:**
- `handleOpen()` - Opens file dialog and loads image via IPC
- `handleSave()` - Saves canvas to PNG via IPC

**Issues:**
- ⚠️ Creates intermediate `window.Image` element for decoding (unnecessary)
- ⚠️ Multiple error states not tracked (only console logs)
- Hardcodes file extension to `.png` regardless of user selection

**Image Loading Flow:**
```
IPC → dataURL → window.Image → readImg() → Image-js instance
```

Could be simplified to directly use dataURL with image-js.

---

### Floating Controls (`src/renderer/components/FloatingControls.tsx` - 247 lines)
**Purpose:** Draggable adjustment panel with sliders and checkbox

**Components:**
- Blur slider (0-10, 0.5 step)
- Threshold slider (0-255)
- Invert checkbox
- Reset button

**Issues:**
- ⚠️ **Code Duplication:** Identical drag-to-persist logic as FloatingImage
  - Both implement: position persistence, drag handling, localStorage save
  - ~40 lines of duplicated code
- ⚠️ No debouncing on slider changes
- ⚠️ Repetitive event listener setup/cleanup

---

### Floating Image Preview (`src/renderer/components/FloatingImage.tsx` - 193 lines)
**Purpose:** Draggable preview of original (unprocessed) image

**Issues:**
- ⚠️ **Code Duplication:** Identical drag logic as FloatingControls
- ⚠️ Uses `showKey` state to force canvas redraw (hacky approach)
- ⚠️ `writeCanvas()` called unnecessarily on every `showKey` change
- ⚠️ Positioned with `position.x/y` inline styles (difficult to maintain)

---

### Root Component (`src/renderer/components/App.tsx` - 26 lines)
**Purpose:** Application shell and component composition

**Issues:**
- `previewCanvasRef` passed but never used (created in App, used in Canvas)
- Could use a ref hook instead of passing through props

---

### Global TypeScript Definitions (`src/renderer/global.d.ts` - 14 lines)
**Purpose:** Type definitions for `window.electronAPI`

**Issues:**
- Correctly typed but minimal

---

## 3. CURRENT PERFORMANCE CHARACTERISTICS

### Build Performance
```
Main process:     19ms  (2.21 KB output)
Preload script:   9ms   (0.53 KB output)
Renderer:         145ms (1,022.59 KB output)
Total:            173ms (1.1 MB final)
```

**Analysis:**
- ✅ Main/preload builds are very fast
- ⚠️ Renderer bundle is 1 MB (large for simple image editor)
  - 572 modules transformed
  - CSS: 16.89 KB
  - JS: 1,022.59 KB

**Contributing Factors:**
- image-js library is heavy (~500 KB potentially)
- Tailwind CSS included in bundle
- React and dependencies

### Runtime Performance

**Memory Usage (Estimated):**
- Baseline: ~50-80 MB (Electron + React runtime)
- With large image: +original size × 2 (original + current clones)
- Large 10MP image = +80 MB clone overhead

**CPU Usage:**
- Slider interaction: High (reprocesses on every frame ~60 fps)
- No debouncing = 60 IPC updates/sec while dragging
- Image filters run on main thread (blocks UI briefly)

**Canvas Rendering:**
- ✅ `writeCanvas()` is efficient
- ⚠️ Full pipeline runs on prop changes (no incremental updates)

---

## 4. CODE QUALITY OBSERVATIONS

### Strengths ✅
1. **Well-organized structure** - Clear separation of main/preload/renderer
2. **Type safety** - Full TypeScript with strict mode
3. **Security** - Proper context isolation and IPC bridge
4. **Component composition** - Modular components with clear responsibilities
5. **React patterns** - Proper use of hooks, useCallback, useEffect
6. **Clean imports** - Organized, consistent import ordering
7. **Error handling** - Try-catch blocks in critical paths
8. **LocalStorage persistence** - Floating panels maintain position

### Weaknesses ⚠️

#### Code Duplication (High Priority)
- **FloatingControls & FloatingImage:** Identical 40+ line drag-to-persist logic
  - Same event listeners, position tracking, localStorage operations
  - **Solution:** Extract into custom hook `useDraggablePanel()`

#### Performance Issues
1. **Effect Dependency Issues**
   - Canvas effect dependencies too broad
   - Runs full filter pipeline unnecessarily
   
2. **Lack of Debouncing**
   - Slider changes trigger immediate filter processing
   - No throttling on drag events
   
3. **Inefficient Image Cloning**
   - Two `.clone()` calls per image load
   - No lazy evaluation of unchanged state
   
4. **Blocking Operations**
   - `fs.writeFileSync()` blocks main thread during save
   - Should use async `fs.promises.writeFile()`

#### Type Safety Issues
- ⚠️ Type cast in main process: `mainWindow as BaseWindow`
- ✅ Otherwise good type coverage

#### Code Style & Maintainability
1. **Biome config incomplete**
   - Only formatter configured, no linting rules
   - No import ordering automation
   
2. **Comments inconsistent**
   - Some sections well commented (preload)
   - Others lacking explanation (Canvas effect logic)
   
3. **Magic numbers**
   - Slider ranges hardcoded (0-10 blur, 0-255 threshold)
   - Window dimensions hardcoded in components
   
4. **Error messages generic**
   - "Failed to load position" appears twice
   - No user-facing error UI

#### Unused Code
- ⚠️ `vite.config.ts` exists but `electron.vite.config.ts` is authoritative
- ⚠️ `previewCanvasRef` passed to App but never used

---

## 5. AREAS FOR OPTIMIZATION AND CLEANUP

### High Priority (Performance Impact)

#### 1. **Extract Drag Logic into Custom Hook** ⭐⭐⭐
**Impact:** Reduce 40+ lines of duplication, improve maintainability

```typescript
// src/renderer/hooks/useDraggablePanel.ts
export const useDraggablePanel = (storageKey: string, defaultPos = { x: 20, y: 20 }) => {
  const [position, setPosition] = useState(defaultPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(defaultPos);

  // Load/save logic here
  // Handle drag logic here
  
  return { position, isDragging, dragOffset, panelRef, positionRef, handleMouseDown, savePosition };
};
```

**Files affected:** FloatingControls.tsx (-50 lines), FloatingImage.tsx (-40 lines)

---

#### 2. **Debounce Slider Changes** ⭐⭐⭐
**Impact:** Reduce filter processing by ~90% during dragging

```typescript
// In useImage.ts - add debounced setters
import { useMemo } from 'react';

const debouncedSetBlur = useMemo(
  () => debounce(setBlur, 150),
  []
);

// Helper:
const debounce = (fn: Function, delay: number) => {
  let timeout: NodeJS.Timeout;
  return (value: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(value), delay);
  };
};
```

---

#### 3. **Use useMemo for Filter Pipeline** ⭐⭐⭐
**Impact:** Prevent redundant filter calculations

```typescript
// In Canvas.tsx
const processed = useMemo(() => {
  let result = currentImage;
  if (threshold > 0) result = result?.grey() as Image;
  if (blur > 0) result = result?.gaussianBlur({ sigma: blur });
  if (threshold > 0) result = result?.threshold({ threshold: threshold / 255 });
  if (invert) result = result?.invert();
  return result;
}, [currentImage, blur, threshold, invert]);

useEffect(() => {
  if (!processed || !previewCanvasRef.current) return;
  writeCanvas(processed, previewCanvasRef.current);
}, [processed, previewCanvasRef]);
```

---

#### 4. **Replace Blocking fs.writeFileSync()** ⭐⭐
**Impact:** Main thread remains responsive during saves

```typescript
// In src/main/index.ts
ipcMain.handle("save-image", async (_event, { dataUrl }) => {
  // ... dialog code ...
  const image = nativeImage.createFromDataURL(dataUrl);
  const pngData = image.toPNG();
  
  // Use async method:
  await fs.promises.writeFile(filePath, pngData);
  return filePath;
});
```

---

#### 5. **Optimize Image Loading** ⭐⭐
**Impact:** Cleaner code, fewer intermediate objects

```typescript
// In BottomPanel.tsx - Current approach:
const img = new window.Image();
await new Promise<void>((resolve, reject) => {
  img.onload = () => resolve();
  img.onerror = () => reject(new Error("Failed to load image element"));
  img.src = result.dataUrl;
});
const image = readImg(img);

// Simplified - if image-js supports it:
// Directly use dataURL or blob in readImg()
```

---

### Medium Priority (Maintainability)

#### 6. **Extract Magic Numbers into Constants** ⭐⭐
**Files:** Canvas.tsx, FloatingControls.tsx, FloatingImage.tsx

```typescript
// src/renderer/constants/filters.ts
export const FILTER_RANGES = {
  BLUR: { min: 0, max: 10, step: 0.5 },
  THRESHOLD: { min: 0, max: 255, step: 1 },
} as const;

export const PANEL_DEFAULTS = {
  SIZE: 40,
  POSITION: { x: 20, y: 20 },
} as const;
```

---

#### 7. **Create Shared Logger/Error Handler** ⭐
**Impact:** Consistent error handling, easier debugging

```typescript
// src/renderer/utils/logger.ts
export const logger = {
  error: (context: string, error: unknown) => {
    console.error(`[${context}]`, error);
    // Could add sentry/telemetry here
  },
  info: (context: string, message: string) => {
    console.log(`[${context}]`, message);
  },
};
```

---

#### 8. **Add Linting Configuration** ⭐
**Current:** biome.json only has formatter config

```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn",
        "noDebugger": "warn"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "jsxQuoteStyle": "single",
      "quoteStyle": "single",
      "lineWidth": 120
    }
  }
}
```

---

#### 9. **Remove Unused vite.config.ts** ⭐
- Keep only `electron.vite.config.ts`
- Both configs define renderer build, but electron-vite takes precedence

---

#### 10. **Simplify ImageContext** ⭐
**Current:** Context just wraps useImage with no additional logic

**Option 1:** Inline into App.tsx if no other providers needed
**Option 2:** Combine with useImage.ts if reusing elsewhere

---

### Low Priority (Polish)

#### 11. **Add User-Facing Error UI**
- Toast notifications for load/save failures
- Visual feedback in UI instead of console logs only

#### 12. **Optimize Tailwind Build**
- Use content configuration to purge unused styles
- Consider CSS-in-JS alternative for smaller bundle

#### 13. **Add TypeScript Path Aliases**
- Already configured in tsconfig.json (`@/*`)
- Ensure consistent usage

#### 14. **Remove Dev Tools in Production**
```typescript
// In src/main/index.ts
if (process.env.NODE_ENV === "development") {
  mainWindow.webContents.openDevTools();
}
```
✅ Already conditional, but could be more explicit

---

## 6. BUILD AND DEPENDENCY OPTIMIZATION

### Current Build Output
```
Total Size: 1.1 MB
- Main: 2.21 KB
- Preload: 0.53 KB  
- Renderer: 1,022.59 KB
- CSS: 16.89 KB
```

### Build Warnings
```
[EVAL] Warning: Use of direct `eval` function
Location: node_modules/file-type/index.js:934:17
Impact: Prevents tree-shaking, security risk
Solution: Check if file-type is actually used; consider alternative
```

---

### Dependency Analysis

**Runtime Dependencies (5 packages, ~8 MB uncompressed):**
- `react@19.2.4` (600 KB)
- `react-dom@19.2.4` (1.2 MB)
- `image-js@1.5.0` (500 KB+)
- `@types/react` (dev only)
- `@types/react-dom` (dev only)

**Dev Dependencies (17 packages):**
- Build chain: electron-vite, vite, esbuild
- CSS: tailwindcss, postcss, autoprefixer
- Tooling: typescript, electron, biome

### Optimization Opportunities

1. **Tree-shake image-js**
   - Only using: readImg, writeCanvas, Image processing methods
   - Check if unused portions are included

2. **Code split for large components**
   - FloatingControls and FloatingImage could be lazy-loaded
   - Low priority (both < 250 KB combined)

3. **CSS Purging**
   - Tailwind default purges unused classes
   - Current 16.89 KB is reasonable for custom classes

4. **Compression**
   - ASAR packaging for Electron reduces size further

---

## 7. SECURITY OBSERVATIONS

### ✅ Implemented
- Context isolation enabled
- Preload bridge for IPC
- Node integration disabled
- No `eval()` in application code
- CSP headers configured

### ⚠️ Considerations
- Sandbox disabled (noted as intentional)
- Main process image saving uses native APIs (secure)
- File dialog properly restricted to images

### Recommendations
1. Consider re-enabling sandbox if functionality permits
2. Add CSP nonce for inline styles if possible
3. Validate file extensions on save

---

## 8. TESTING & QUALITY ASSURANCE

### Current State
- ❌ No tests configured (noted in package.json)
- ✅ TypeScript strict mode enabled
- ✅ Biome formatter configured

### Recommended Additions
1. **Unit Tests** - Core hooks (useImage, useDraggablePanel)
2. **Integration Tests** - IPC handlers, image loading/saving
3. **E2E Tests** - Electron app workflows
4. **Performance Tests** - Large image handling, filter performance

**Suggested Framework:** Vitest + React Testing Library

---

## 9. MAINTAINABILITY SCORE

| Aspect | Score | Notes |
|--------|-------|-------|
| Code Organization | 8/10 | Clear structure, some duplication |
| Type Safety | 9/10 | Strict TypeScript, minimal casts |
| Testability | 3/10 | No tests, some tightly coupled logic |
| Performance | 5/10 | Functional but unoptimized |
| Documentation | 4/10 | Minimal comments, brief README |
| Consistency | 7/10 | Mostly consistent, some patterns vary |
| Dependencies | 7/10 | Clean, mostly necessary |

**Overall Maintainability: 6.5/10**

---

## 10. SUMMARY OF RECOMMENDATIONS

### Quick Wins (1-2 hours each)
1. ✅ Extract `useDraggablePanel()` hook
2. ✅ Add debounce to slider changes
3. ✅ Remove unused `vite.config.ts`
4. ✅ Replace `fs.writeFileSync()` with async

### Medium Effort (2-4 hours each)
1. ✅ Extract magic numbers to constants
2. ✅ Add shared logger/error handler
3. ✅ Apply useMemo to filter pipeline
4. ✅ Complete biome linting configuration

### Larger Refactors (4+ hours)
1. ✅ Add test suite (unit + integration)
2. ✅ Create comprehensive error UI
3. ✅ Consider image processing web worker
4. ✅ Build optimization and code splitting

### Immediate Priority
**Start with:**
1. `useDraggablePanel` hook extraction (most impact/effort ratio)
2. Slider debouncing (improves responsiveness immediately)
3. `fs.writeFileSync()` → async (unblocks UI)

---

## Appendix: File Statistics

### Lines of Code by Component
```
src/main/index.ts                103 lines (Core app logic)
src/preload/index.ts              9 lines (IPC bridge)
src/renderer/components/
  - FloatingControls.tsx        247 lines (Largest: drag + controls)
  - FloatingImage.tsx           193 lines (Drag + canvas)
  - BottomPanel.tsx              90 lines
  - Canvas.tsx                   84 lines (Main preview)
  - App.tsx                      26 lines (Minimal)
src/renderer/hooks/
  - useImage.ts                  95 lines
  - ImageContext.tsx             41 lines
src/renderer/
  - index.tsx                    13 lines
  - global.d.ts                  14 lines
  - styles.css                   12 lines
  - index.html                   17 lines

Total:                          915 lines (Source)
```

### Duplication Analysis
```
Drag Logic: 40+ lines duplicated
- FloatingControls: lines 20-96
- FloatingImage: lines 12-96
Same patterns for:
  - localStorage persistence
  - Position tracking
  - Event listener setup/cleanup
```

### Complexity Analysis
```
High Complexity:
  - Canvas.tsx useEffect (lines 12-41) - Multiple conditionals, side effects
  - FloatingImage.tsx useEffect (lines 72-96) - Event listener chains
  - FloatingControls.tsx useEffect (lines 69-93) - Similar

Moderate:
  - useImage.ts - Clean state management
  - BottomPanel.tsx - Straightforward event handlers
```

---

**Analysis Complete** - Ready for team discussion and prioritization.
