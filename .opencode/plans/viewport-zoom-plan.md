# Viewport Resize & Zoom Plan

## Problem

1. **Vertical clipping**: Large images overflow vertically — silently clipped by `overflow-hidden` on the app shell (App.tsx LAYER 2). Users cannot see the bottom of tall images.
2. **No zoom/scale mechanism**: No state, UI, or constants exist for zoom/pan. The image always renders at native pixel dimensions via `writeCanvas()`.
3. **FloatingImage overflow**: The Original panel has no height constraint — tall/portrait images push it off-screen with no scrollbar.

## Approach

- **Fit-to-view** as default behavior (auto-scale image to fit available space, never upscale beyond 100%)
- **Manual zoom** via slider/buttons (25%–400%) + Ctrl+scroll wheel
- **CSS `transform: scale()`** strategy — `writeCanvas()` stays untouched, `previewCanvasRef` remains at native resolution (critical for save/export in BottomPanel)
- **Scrollable container** for pan when zoomed beyond fit
- **`image-rendering: pixelated`** for crisp nearest-neighbor scaling on binary/threshold output

## Technical Context

### How `writeCanvas` works (image-js)

`writeCanvas(image, canvas)` in `node_modules/image-js/src/save/writeCanvas.ts`:
- Sets `canvas.width` / `canvas.height` HTML attributes to the image's pixel dimensions (default `resizeCanvas: true`)
- Uses `ctx.putImageData()` — which **ignores** any 2D context transforms (scale, translate, rotate)
- No built-in scaling options

This means:
- We cannot do canvas-level scaling via context transforms
- CSS transform is the correct strategy — the canvas buffer stays at native resolution
- `previewCanvasRef` continues to work for save/export without changes

### Current layout chain (App → Canvas)

```
App.tsx LAYER 1: div.flex.flex-col.h-screen       → full viewport height
App.tsx LAYER 2: div.flex-1.flex.flex-col.overflow-hidden → fills remaining space, clips overflow
  Canvas.tsx wrapper: div.flex-1.flex.items-center.justify-center.p-8
    Canvas.tsx card: div.bg-white.rounded-lg.shadow-lg.p-4
      <canvas max-w-full max-h-full>               → max-h-full is INEFFECTIVE (parent is intrinsically sized)
  BottomPanel: div.h-8                              → fixed 32px status bar
```

The `max-h-full` on the canvas resolves against the CARD div which has no explicit height (intrinsically sized), so it does nothing. Horizontal scaling works because flex width constraints propagate; vertical does not.

### FloatingImage sizing

- Panel: `position: fixed`, `width: 40%`, `maxWidth: 350px` — no height constraint
- Canvas: `w-full` (CSS `width: 100%`) — scales width, but height is unconstrained
- `writeCanvas()` sets native pixel dimensions on every render

---

## Changes

### 1. Add zoom constants — `src/renderer/constants/ui.ts`

Add a `ZOOM` section to the `UI` constant:

```ts
ZOOM: {
  MIN: 0.25,       // 25%
  MAX: 4,          // 400%
  STEP: 0.25,      // step for +/- buttons and keyboard shortcuts
  WHEEL_STEP: 0.1, // step per Ctrl+wheel tick
  FIT_MAX: 1,      // fit-to-view never upscales beyond 100%
},
```

### 2. Add zoom state — `src/renderer/hooks/useImage.ts`

New state fields in `ImageState`:

```ts
zoom: number;                  // current manual zoom level (default 1)
fitMode: 'fit' | 'manual';    // 'fit' = auto-scale to container, 'manual' = user-controlled
```

New actions:

```ts
setZoom: (value: number) => void;       // clamp to [ZOOM.MIN, ZOOM.MAX], switch to 'manual' mode
setFitMode: (mode: 'fit' | 'manual') => void;
zoomIn: () => void;                     // zoom += ZOOM.STEP, switch to 'manual'
zoomOut: () => void;                    // zoom -= ZOOM.STEP, switch to 'manual'
```

Behavior:
- `loadImage()` → reset to `fitMode: 'fit'`, `zoom: 1`
- `resetImage()` → reset to `fitMode: 'fit'`, `zoom: 1`
- `setZoom` clamps value to `[UI.ZOOM.MIN, UI.ZOOM.MAX]`

### 3. Expose via context — `src/renderer/hooks/ImageContext.tsx`

Add `zoom`, `fitMode`, `setZoom`, `setFitMode`, `zoomIn`, `zoomOut` to the context value and type.

### 4. Refactor Canvas.tsx — fit-to-view + zoom

This is the core change. Replace the current static layout with a measured, zoomable viewport.

#### Container structure

```tsx
<div ref={containerRef} className='flex-1 overflow-auto relative'>
  {/* when fitMode === 'fit': center the canvas */}
  {/* when fitMode === 'manual': anchor top-left, scrollbars appear */}
  <div
    style={{
      width: canvas.width * effectiveZoom,
      height: canvas.height * effectiveZoom,
      // when fit mode + image smaller than container, center it:
      margin: fitMode === 'fit' ? 'auto' : undefined,
    }}
  >
    <canvas
      ref={previewCanvasRef}
      style={{
        transform: `scale(${effectiveZoom})`,
        transformOrigin: '0 0',
        imageRendering: 'pixelated',
      }}
    />
  </div>
</div>
```

The outer spacer div with explicit `width`/`height` = scaled dimensions ensures the scroll container gets the correct scrollable area (since `transform: scale` doesn't affect layout size).

#### Fit-to-view calculation

```ts
const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

// ResizeObserver on containerRef to track available space
useEffect(() => {
  if (!containerRef.current) return;
  const observer = new ResizeObserver(([entry]) => {
    setContainerSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    });
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);

// Compute fit scale (never upscale beyond 100%)
const fitScale = useMemo(() => {
  if (!currentImage || containerSize.width === 0 || containerSize.height === 0) return 1;
  const padding = 48; // visual padding (equivalent to current p-8 + p-4)
  const availW = containerSize.width - padding;
  const availH = containerSize.height - padding;
  return Math.min(availW / currentImage.width, availH / currentImage.height, UI.ZOOM.FIT_MAX);
}, [currentImage, containerSize]);

// Effective zoom
const effectiveZoom = fitMode === 'fit' ? fitScale : zoom;
```

#### Ctrl+wheel handler

```ts
const handleWheel = useCallback((e: WheelEvent) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -UI.ZOOM.WHEEL_STEP : UI.ZOOM.WHEEL_STEP;
  const currentEffective = fitMode === 'fit' ? fitScale : zoom;
  setZoom(Math.round((currentEffective + delta) * 100) / 100);
}, [fitMode, fitScale, zoom, setZoom]);

// Attach to container (must use { passive: false } to preventDefault on wheel)
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  el.addEventListener('wheel', handleWheel, { passive: false });
  return () => el.removeEventListener('wheel', handleWheel);
}, [handleWheel]);
```

#### Visual styling

- Keep the white card background + shadow + rounded corners + border
- Remove `p-8` from outer wrapper (padding is now accounted for in fitScale calculation)
- Add subtle thin scrollbar styling in `styles.css` if desired (optional polish)

### 5. Add zoom controls to BottomPanel — `src/renderer/components/shell/BottomPanel.tsx`

Add zoom controls between file info and status indicator in the bottom bar:

```tsx
{/* Zoom controls */}
<div className='flex items-center gap-1 mr-3'>
  <button onClick={zoomOut} disabled={!hasImage} title='Zoom Out (Ctrl+-)'>
    −
  </button>

  <button
    onClick={() => setFitMode('fit')}
    disabled={!hasImage}
    title='Fit to View (Ctrl+0)'
    className={fitMode === 'fit' ? 'text-slate-200' : 'text-slate-400'}
  >
    Fit
  </button>

  <span className='text-slate-400 text-[10px] w-8 text-center'>
    {Math.round(effectiveZoom * 100)}%
  </span>

  <button onClick={zoomIn} disabled={!hasImage} title='Zoom In (Ctrl+=)'>
    +
  </button>
</div>
```

The `effectiveZoom` must be available here. Either:
- Compute it in the context (preferred — derive `effectiveZoom` from `fitMode`, `zoom`, and a `fitScale` that Canvas reports back), or
- Pass `fitScale` up from Canvas via a callback/ref, or
- Simply display `zoom` in manual mode and "Fit" text in fit mode

Simplest approach: BottomPanel shows `Math.round(zoom * 100)%` in manual mode and "Fit" in fit mode. The exact fit percentage is a Canvas-internal detail.

### 6. Constrain FloatingImage height — `src/renderer/components/FloatingImage.tsx`

Two changes:

**a) Add `maxHeight` to panelStyle:**

```tsx
panelStyle={{ width: '40%', maxWidth: '350px', maxHeight: '60vh' }}
```

**b) Add `overflow-auto` to the canvas wrapper:**

```tsx
<div className='p-2 overflow-auto' style={{ maxHeight: 'calc(60vh - 40px)' }}>
  <canvas ref={originalCanvasRef} key={showKey} className='w-full border border-slate-200 rounded' />
</div>
```

The `40px` accounts for the FloatingPanel title bar height (`px-3 py-2` = ~36px + 1px border).

The existing `w-full` on the canvas continues to scale width correctly. With `overflow-auto`, if the proportionally-scaled image exceeds the max height, a scrollbar appears.

### 7. Add keyboard shortcuts — `src/renderer/hooks/useKeyboardShortcuts.ts`

Add to the existing keydown handler:

| Shortcut | Action |
|----------|--------|
| `Ctrl+0` | `setFitMode('fit')` — reset to fit-to-view |
| `Ctrl+=` (`Ctrl+Shift+=` on US keyboards) | `zoomIn()` |
| `Ctrl+-` | `zoomOut()` |

These should be gated on `hasImage`.

### 8. Update tests — `tests/unit/hooks/useImage.test.ts`

Add test cases for:

- Initial state: `zoom === 1`, `fitMode === 'fit'`
- `setZoom(2)` → `zoom === 2`, `fitMode === 'manual'`
- `setZoom(0.1)` → clamped to `UI.ZOOM.MIN` (0.25)
- `setZoom(10)` → clamped to `UI.ZOOM.MAX` (4)
- `zoomIn()` → `zoom += UI.ZOOM.STEP`
- `zoomOut()` → `zoom -= UI.ZOOM.STEP`
- `setFitMode('fit')` → `fitMode === 'fit'`
- `loadImage()` resets `fitMode` to `'fit'` and `zoom` to `1`
- `resetImage()` resets `fitMode` to `'fit'` and `zoom` to `1`

---

## Execution Order

| Step | Files | Description |
|------|-------|-------------|
| 1 | `ui.ts` | Add `ZOOM` constants |
| 2 | `useImage.ts`, `ImageContext.tsx` | Add zoom/fitMode state + actions, expose via context |
| 3 | `Canvas.tsx` | Fit-to-view logic, CSS transform zoom, scroll container, ResizeObserver, Ctrl+wheel |
| 4 | `BottomPanel.tsx` | Zoom controls in status bar |
| 5 | `FloatingImage.tsx` | Add maxHeight + overflow constraint |
| 6 | `useKeyboardShortcuts.ts` | Ctrl+0, Ctrl+=, Ctrl+- |
| 7 | `useImage.test.ts` | Zoom state tests |
| 8 | Verify | `yarn typecheck && yarn test && yarn lint && yarn format:check` |

## Files Changed

| File | Type | Summary |
|------|------|---------|
| `src/renderer/constants/ui.ts` | modify | Add `ZOOM` constants block |
| `src/renderer/hooks/useImage.ts` | modify | Add `zoom`, `fitMode` state + `setZoom`, `setFitMode`, `zoomIn`, `zoomOut` actions |
| `src/renderer/hooks/ImageContext.tsx` | modify | Expose zoom state and actions in context |
| `src/renderer/components/Canvas.tsx` | modify | Fit-to-view + zoom transform + scroll container + ResizeObserver + Ctrl+wheel |
| `src/renderer/components/shell/BottomPanel.tsx` | modify | Zoom controls (Fit button, percentage, +/- buttons) |
| `src/renderer/components/FloatingImage.tsx` | modify | Add `maxHeight: '60vh'` + `overflow-auto` on canvas wrapper |
| `src/renderer/hooks/useKeyboardShortcuts.ts` | modify | Add Ctrl+0, Ctrl+=, Ctrl+- shortcuts |
| `tests/unit/hooks/useImage.test.ts` | modify | Add zoom/fitMode state tests |

## Design Decisions

- **CSS `transform: scale()` over canvas-level scaling**: `writeCanvas()` uses `putImageData()` which ignores context transforms. CSS transform keeps the canvas at native resolution (required for save/export) while providing visual scaling. `image-rendering: pixelated` ensures crisp output for binary images.
- **Spacer div for scroll area**: `transform: scale()` doesn't affect layout dimensions, so a wrapper div with explicit `width`/`height` = scaled dimensions is needed for the scroll container to calculate scrollbar range correctly.
- **Fit-to-view never upscales**: `fitScale` is capped at `1.0` so small images display at native size, not stretched.
- **Zoom controls in BottomPanel**: Minimal footprint, always visible, consistent with editor conventions (VS Code, Figma, etc.).
- **Ctrl+wheel (not bare wheel)**: Prevents accidental zoom when scrolling a zoomed-in image. Standard editor convention.
- **FloatingImage `maxHeight: 60vh`**: Prevents the panel from exceeding 60% of viewport height. The drag system's position clamping (in `useDraggablePanel.ts`) already uses `offsetHeight`, so it will respect the constrained height for bounds calculation.

---

## Addendum: FloatingWidget Rename + Gallery Panel Refactor

### Problem

1. **FloatingPanel** is in `components/FloatingPanel.tsx` but is a reusable primitive used by FloatingControls, FloatingImage, and FloatingCounter — it belongs in `shared/`.
2. **OpenDialog** is a modal overlay that blocks the entire UI. The gallery/recents should be a persistent, toggle-able side panel (snapped to the right edge, full height) that the user can browse at any time — not a blocking dialog.
3. **"Open" button** in BottomPanel currently opens the modal dialog. It should instead trigger a native file picker directly (browse from computer), and the opened file gets added to recents as it does now. The gallery panel is a separate, independently toggle-able panel for browsing recents.

### Approach

- **Rename** `FloatingPanel` → `FloatingWidget` and move to `shared/FloatingWidget.tsx`
- **Convert** the modal `OpenDialog` into a docked `GalleryPanel` — a full-height panel snapped to the right edge of the viewport
- **Gallery is toggle-able** like other panels via `panels.gallery` state + `Alt+4` shortcut + minimized icon in BottomPanel
- **"Open" button** in BottomPanel triggers `electronAPI.openImage()` directly (no dialog), loads the image, adds to recents
- **Gallery panel** shows the recents grid and lets the user click to load any recent image at any time

### Current state (what exists today)

```
FloatingPanel.tsx (components/)
├── Used by: FloatingControls, FloatingImage, FloatingCounter
├── Props: title, storageKey, defaultPosition, isOpen, onClose, titleBarActions?, panelStyle?, zClass?, children
├── Uses: useDraggablePanel hook internally
└── Renders: fixed-position draggable panel with title bar + close button + children

OpenDialog.tsx (shell/)
├── Modal overlay (fixed inset-0, bg-black/50 backdrop)
├── Centered 480px card with header + body
├── Fetches recents via electronAPI.getRecents()
├── Has "Browse Files..." button that calls electronAPI.openImage()
├── Click recent thumbnail → electronAPI.openImageFromPath()
├── Remove recent via X button
├── Escape to close
└── Controlled by BottomPanel's openDialogVisible state

BottomPanel.tsx (shell/)
├── "Open" button → setOpenDialogVisible(true)
├── "Save" button → handleSave()
├── Ctrl+O → handleOpen() (opens dialog)
├── Renders <OpenDialog> at the bottom
└── Panel state: panels = { controls, original, timer }

useImage.ts
├── PanelId = 'controls' | 'original' | 'timer'
├── panels: Record<PanelId, boolean>
├── togglePanel(id) / setPanel(id, open)
└── DEFAULT_PANELS = { controls: true, original: true, timer: true }
```

---

### Changes

#### 9. Rename FloatingPanel → FloatingWidget — move to `shared/`

**a) Create `src/renderer/components/shared/FloatingWidget.tsx`:**
- Copy the content of `FloatingPanel.tsx` verbatim
- Rename the component and interface: `FloatingWidget`, `FloatingWidgetProps`
- Update the `Icon` import path (now a sibling: `./Icon` instead of `./shared/Icon`)

**b) Delete `src/renderer/components/FloatingPanel.tsx`**

**c) Update all consumers:**

| File | Change |
|------|--------|
| `FloatingControls.tsx` | `import FloatingWidget from './shared/FloatingWidget'` → replace `<FloatingPanel>` with `<FloatingWidget>` |
| `FloatingImage.tsx` | Same |
| `FloatingCounter.tsx` | Same |

This is a pure rename — no behavior changes.

#### 10. Add `'gallery'` to panel state — `src/renderer/hooks/useImage.ts`

**a) Expand `PanelId`:**

```ts
type PanelId = 'controls' | 'original' | 'timer' | 'gallery';
```

**b) Update `DEFAULT_PANELS`:**

```ts
const DEFAULT_PANELS: Record<PanelId, boolean> = {
  controls: true,
  original: true,
  timer: true,
  gallery: false,   // closed by default
};
```

**c) No other state changes** — `togglePanel` and `setPanel` already work with any `PanelId`.

#### 11. Convert OpenDialog → GalleryPanel — `src/renderer/components/shell/GalleryPanel.tsx`

Replace the modal `OpenDialog.tsx` with a docked side panel:

**Layout:**
- `position: fixed`, snapped to the right edge: `top: 0`, `right: 0`, `bottom: 32px` (above BottomPanel's `h-8`)
- Width: `280px` (narrow enough to not cover too much canvas)
- Background: `bg-white`, border-left, shadow
- `z-index: z-50` (same level as floating widgets)
- Slide-in/out transition (optional polish: `translate-x` transition)

**Structure:**

```tsx
const GalleryPanel: React.FC = () => {
  const { panels, setPanel, loadImage } = useImageContext();
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch recents when panel opens (and on successful load)
  // ... same fetchRecents / loadFromDataUrl / handleRecentClick / handleRemoveRecent logic from OpenDialog

  if (!panels.gallery) return null;

  return (
    <div className='fixed top-0 right-0 bottom-8 w-[280px] bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between px-3 py-2 border-b border-slate-100'>
        <span className='text-xs font-semibold text-slate-700'>Gallery</span>
        <button onClick={() => setPanel('gallery', false)}>
          <Icon name='close' />
        </button>
      </div>

      {/* Body — scrollable */}
      <div className='flex-1 overflow-y-auto p-3 space-y-3'>
        {error && <div className='...'>{error}</div>}

        <SectionHeader>Recents</SectionHeader>
        {/* 2-column grid (narrower panel than the old 4-col dialog) */}
        <div className='grid grid-cols-2 gap-2'>
          {recents.map((entry) => (
            /* same thumbnail card, slightly smaller */
          ))}
        </div>

        {recents.length === 0 && (
          <p className='text-xs text-slate-400 py-4 text-center'>No recent images</p>
        )}
      </div>
    </div>
  );
};
```

**Key differences from OpenDialog:**
- No backdrop overlay — the canvas remains interactive behind it
- No "Browse Files..." button — file browsing is handled by the "Open" button in BottomPanel
- No `onImageLoaded` callback — it just loads the image via context and optionally stays open
- Panel is toggle-able via `panels.gallery` state, not a local `openDialogVisible`
- 2-column grid (280px is narrower than the old 480px dialog)
- Full height, scrollable body for many recents
- Fetches recents on open AND after each successful image load (to show the newly added entry)

#### 12. Rewire BottomPanel — `src/renderer/components/shell/BottomPanel.tsx`

**a) "Open" button now directly opens a file:**

```tsx
const handleOpen = useCallback(async () => {
  try {
    setStatus('loading');
    const result = await window.electronAPI.openImage();
    if (result?.dataUrl) {
      await loadFromDataUrl(result.dataUrl, result.path);
      setStatus('loaded');
    } else {
      setStatus(hasImage ? 'loaded' : 'ready');
    }
  } catch (err) {
    setStatus('error');
    console.error('Failed to open image:', err);
  }
}, [loadFromDataUrl, hasImage]);
```

Note: `loadFromDataUrl` needs to move from OpenDialog to either BottomPanel or a shared utility. Since both BottomPanel and GalleryPanel need it, extract to a shared hook or utility (see step 13).

**b) Remove `OpenDialog` import and rendering**

**c) Remove `openDialogVisible` state** — no longer needed

**d) Add gallery toggle icon** to the minimized panel icons section:

```tsx
{!panels.gallery && (
  <button
    type='button'
    onClick={() => setPanel('gallery', true)}
    className='w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-200'
    title='Show Gallery (Alt+4)'
  >
    <Icon name='gallery' size='sm' />
  </button>
)}
```

**e) `Ctrl+O` shortcut stays** — still calls `handleOpen()` which now directly opens the native file picker

#### 13. Extract `loadFromDataUrl` — shared utility

Both BottomPanel and GalleryPanel need to convert a dataUrl + filePath into a loaded image. Extract this as a reusable function:

**Option A: Custom hook `useImageLoader`** in `src/renderer/hooks/useImageLoader.ts`:

```ts
import { readImg } from 'image-js';
import { useCallback } from 'react';
import { useImageContext } from './ImageContext';

export function useImageLoader() {
  const { loadImage } = useImageContext();

  const loadFromDataUrl = useCallback(
    async (dataUrl: string, filePath: string) => {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image element'));
        img.src = dataUrl;
      });
      const image = readImg(img);
      const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';
      await loadImage(image, fileName, filePath);
    },
    [loadImage],
  );

  return { loadFromDataUrl };
}
```

Both `BottomPanel` and `GalleryPanel` call `const { loadFromDataUrl } = useImageLoader()`.

#### 14. Add `'gallery'` icon to Icon registry — `src/renderer/components/shared/Icon.tsx`

Add a grid/gallery icon to `ICON_PATHS`. A simple 2x2 grid icon:

```ts
gallery: [
  'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z',
],
```

(Or use a Heroicons `view-grid` / `squares-2x2` path — verify exact `d` value at implementation time.)

#### 15. Add `Alt+4` keyboard shortcut — `src/renderer/hooks/useKeyboardShortcuts.ts`

```ts
if (e.altKey && e.key === '4') {
  e.preventDefault();
  togglePanel('gallery');
  return;
}
```

#### 16. Delete `src/renderer/components/shell/OpenDialog.tsx`

No longer needed — replaced by GalleryPanel.

#### 17. Update App.tsx layout — `src/renderer/components/shell/App.tsx`

Add `GalleryPanel` to the component tree. Since it's `position: fixed`, placement in the tree doesn't affect layout, but it should be inside the `ImageProvider`:

```tsx
import GalleryPanel from './GalleryPanel';

const AppContent: React.FC = () => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  useKeyboardShortcuts();

  return (
    <div className='flex flex-col h-screen bg-slate-100'>
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Canvas previewCanvasRef={previewCanvasRef} />
        <FloatingImage />
        <FloatingControls />
        <FloatingCounter />
        <GalleryPanel />
        <BottomPanel previewCanvasRef={previewCanvasRef} />
      </div>
    </div>
  );
};
```

#### 18. Update tests

- Update panel state tests: initial `panels.gallery === false`
- Test `togglePanel('gallery')` toggles the gallery
- Test `setPanel('gallery', true)` opens the gallery
- Remove any OpenDialog-specific test references if they exist

---

### Updated Execution Order (full plan)

| Step | Files | Description |
|------|-------|-------------|
| 1 | `ui.ts` | Add `ZOOM` constants |
| 2 | `useImage.ts`, `ImageContext.tsx` | Add zoom/fitMode state + actions, add `'gallery'` to PanelId |
| 3 | `Canvas.tsx` | Fit-to-view logic, CSS transform zoom, scroll container, ResizeObserver, Ctrl+wheel |
| 4 | `FloatingPanel.tsx` → `shared/FloatingWidget.tsx` | Rename + move to shared, update all consumer imports |
| 5 | `Icon.tsx` | Add `'gallery'` icon to registry |
| 6 | `useImageLoader.ts` (new) | Extract `loadFromDataUrl` shared hook |
| 7 | `GalleryPanel.tsx` (new) | Create docked right-side gallery panel using recents |
| 8 | `BottomPanel.tsx` | Rewire "Open" to direct file picker, remove OpenDialog, add gallery toggle icon + zoom controls |
| 9 | `OpenDialog.tsx` | Delete |
| 10 | `App.tsx` | Add GalleryPanel to component tree |
| 11 | `FloatingImage.tsx` | Add maxHeight + overflow constraint |
| 12 | `useKeyboardShortcuts.ts` | Add Ctrl+0, Ctrl+=, Ctrl+-, Alt+4 |
| 13 | `useImage.test.ts` | Add zoom state + gallery panel tests |
| 14 | Verify | `yarn typecheck && yarn test && yarn lint && yarn format:check` |

### Updated Files Changed (full plan)

| File | Type | Summary |
|------|------|---------|
| `src/renderer/constants/ui.ts` | modify | Add `ZOOM` constants block |
| `src/renderer/hooks/useImage.ts` | modify | Add zoom/fitMode state, add `'gallery'` to PanelId + DEFAULT_PANELS |
| `src/renderer/hooks/ImageContext.tsx` | modify | Expose zoom state and actions in context (auto via ReturnType) |
| `src/renderer/hooks/useImageLoader.ts` | **new** | Extract shared `loadFromDataUrl` hook |
| `src/renderer/components/shared/FloatingWidget.tsx` | **new** (moved) | Renamed from FloatingPanel, moved to shared/ |
| `src/renderer/components/FloatingPanel.tsx` | **delete** | Replaced by shared/FloatingWidget |
| `src/renderer/components/shared/Icon.tsx` | modify | Add `'gallery'` icon path |
| `src/renderer/components/Canvas.tsx` | modify | Fit-to-view + zoom transform + scroll container |
| `src/renderer/components/FloatingControls.tsx` | modify | Import FloatingWidget from shared/ |
| `src/renderer/components/FloatingImage.tsx` | modify | Import FloatingWidget from shared/, add maxHeight + overflow |
| `src/renderer/components/FloatingCounter.tsx` | modify | Import FloatingWidget from shared/ |
| `src/renderer/components/shell/GalleryPanel.tsx` | **new** | Docked right-side gallery panel with recents grid |
| `src/renderer/components/shell/BottomPanel.tsx` | modify | Direct file open, remove OpenDialog, add gallery icon + zoom controls |
| `src/renderer/components/shell/OpenDialog.tsx` | **delete** | Replaced by GalleryPanel |
| `src/renderer/components/shell/App.tsx` | modify | Add GalleryPanel to component tree |
| `src/renderer/hooks/useKeyboardShortcuts.ts` | modify | Add Ctrl+0, Ctrl+=, Ctrl+-, Alt+4 |
| `tests/unit/hooks/useImage.test.ts` | modify | Add zoom state + gallery panel tests |

### Design Decisions (addendum)

- **FloatingWidget in shared/**: It's a reusable primitive (title bar + drag + close + children) consumed by 3+ components — belongs with the other shared primitives (Icon, PillButton, etc.).
- **Docked panel vs modal**: A persistent side panel lets users browse recents without losing context of their current work. The canvas and floating widgets remain interactive. This is more aligned with editor UX (VS Code explorer, Figma layers panel).
- **Gallery closed by default**: Most users open a specific file. The gallery is opt-in via Alt+4 or the minimized icon. Power users who want quick switching can keep it open.
- **2-column grid in gallery**: 280px panel width ÷ 2 columns ≈ 120px thumbnails — large enough to identify images, small enough to show several at once.
- **"Open" = native file picker**: Keeps Ctrl+O as a fast path to open a file. The gallery is a separate browsing experience. This separation of concerns is cleaner than overloading one UI element.
- **`useImageLoader` hook**: Avoids duplicating the dataUrl → Image → loadImage pipeline in both BottomPanel and GalleryPanel. Single source of truth for the image loading logic.
- **`bottom: 32px` on GalleryPanel**: Ensures the panel doesn't cover the BottomPanel status bar (`h-8` = 32px). The gallery sits between the top of the viewport and the status bar.
