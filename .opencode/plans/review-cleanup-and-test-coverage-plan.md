# Review Cleanup & Test Coverage Plan

## Problem

A code review surfaced 5 bugs, 7 code smells, 1 security concern, and 2 structural issues. Separately, the ARCHITECTURE.md medium-term roadmap calls for component-level test coverage. This plan addresses both.

The "profile with large images" and "web worker for filters" medium-term items are already covered by `large-image-stability-performance-plan.md` and are not duplicated here.

---

## Bugs

### 1. Stale zoom percentage display — `src/renderer/components/shell/BottomPanel.tsx:246`

**Severity:** Medium

`BottomPanel` reads `effectiveZoomRef.current` (a mutable ref) in JSX. Refs do not trigger re-renders, so the displayed percentage can be stale — it only updates when some *other* state change causes BottomPanel to re-render. For example, if `fitScale` changes because the container resizes, the percentage won't update.

**Fix:** Replace the ref read with reactive state. Options:
- Lift `effectiveZoom` into the image context as derived state (preferred — BottomPanel and Canvas both need it).
- Or, have Canvas report `effectiveZoom` back to BottomPanel via a callback that sets local state.

The first option is cleaner. Add a `effectiveZoom` field to context, computed from `fitMode`, `zoom`, and a `fitScale` value reported by Canvas via a `setFitScale` action. BottomPanel then reads `effectiveZoom` from context (reactive, triggers re-render on change).

### 2. Counter timer stops one tick late — `src/renderer/hooks/useImage.ts:326`

**Severity:** Low

When `counter` is 1, the check `prev.counter <= 0` is false, so it decrements to 0. The timer continues for one more tick before clearing. The user sees "0" displayed for a full interval before the timer stops.

**Fix:** Change the condition to check *after* decrementing:

```ts
const next = prev.counter - 1;
if (next <= 0) {
  clearInterval(timerRef.current);
  return { ...prev, counter: 0, counterRunning: false };
}
return { ...prev, counter: next };
```

### 3. `save-image` casts away null check — `src/main/index.ts:180`

**Severity:** Low

`mainWindow as BaseWindow` suppresses TypeScript's null check. If save IPC races with window destruction, this crashes.

**Fix:** Add a guard:

```ts
if (!mainWindow) return null;
const result = await dialog.showSaveDialog(mainWindow, { ... });
```

### 4. Worker error fallback skips transfer list — `src/renderer/workers/imageProcessor.worker.ts:175`

**Severity:** Low

The error path sends `req.data` back via `postMessage` without a transfer list, causing a full buffer copy. On large images this can cause a noticeable pause.

**Fix:** Add a transfer list to the error-path `postMessage`, same as the happy path:

```ts
const buffer = req.data.buffer;
self.postMessage({ id: req.id, data: req.data }, [buffer]);
```

### 5. Blank thumbnails for corrupt/non-image files — `src/main/index.ts:45-46`

**Severity:** Low

`nativeImage.createFromPath` returns an empty image for unsupported formats (doesn't throw). The entry is stored with a blank `thumbnail`, showing a broken card in the recents gallery.

**Fix:** Check `image.isEmpty()` before storing:

```ts
const image = nativeImage.createFromPath(filePath);
if (image.isEmpty()) return; // skip — not a valid image
```

---

## Code Smells

### 6. Duplicated raw-image-to-ImageData conversion

**Locations:**
- `src/renderer/components/Canvas.tsx:99-102`
- `src/renderer/components/FloatingImage.tsx:44-48`
- `src/renderer/hooks/useImageProcessingWorker.ts:18-25` (`imageToUint8Clamped`)

The same byte-copy loop appears three times.

**Fix:** Extract a single utility function (e.g. `imageToImageData(image)`) in a shared module (e.g. `src/renderer/utils/imageConversion.ts`) and import from all three locations. The existing `imageToUint8Clamped` in `useImageProcessingWorker.ts` is close but returns `Uint8ClampedArray` rather than `ImageData`. Extend it to return `ImageData` and move to a shared location.

### 7. Duplicated `RecentEntry` interface

**Locations:**
- `src/main/index.ts:11-16`
- `src/renderer/global.d.ts:3-8`
- `src/renderer/components/shell/GalleryPanel.tsx:7-12`

Three independent definitions of the same type.

**Fix:** Define `RecentEntry` once in a shared types file (e.g. `src/shared/types.ts`) and import from all three locations. Both main and renderer can import from `src/shared/`. The preload bridge serializes/deserializes, so this is a compile-time-only dependency.

### 8. Duplicated default state object — `src/renderer/hooks/useImage.ts`

`loadImage` (~line 124-140) and `resetImage` (~line 149-165) both construct near-identical default state objects inline.

**Fix:** Extract a `DEFAULT_IMAGE_STATE` constant (or function if it needs dynamic parts) and reuse in both `loadImage` and `resetImage`.

### 9. Unused constants — `src/renderer/constants/ui.ts:28,30`

`WARN_FILE_BYTES` and `WARN_PIXELS` are defined but never referenced.

**Fix:** Remove them. The `large-image-stability-performance-plan.md` will re-add them under `UI.PERF` when that plan is implemented.

### 10. Unused CSS custom properties — `src/renderer/styles.css:3-12`

All CSS custom properties (`--color-bg`, `--color-surface`, etc.) are defined but never referenced. The app uses Tailwind utilities exclusively.

**Fix:** Remove the unused custom property declarations from `styles.css`.

### 11. `isInRecents` fragile without cache guard — `src/main/index.ts:61-63`

`isInRecents` reads from `recentsCache` which is `null` until `loadRecents()` is called. It silently returns `false` due to optional chaining if called before initialization.

**Fix:** Add an explicit early return with a comment:

```ts
function isInRecents(filePath: string): boolean {
  if (!recentsCache) return false; // cache not yet loaded
  return recentsCache.some((entry) => entry.path === filePath);
}
```

This is already the effective behavior, but making it explicit prevents future confusion.

### 12. `useKeyboardShortcuts` re-registers on every history change — `src/renderer/hooks/useKeyboardShortcuts.ts:30-41`

`canUndo` and `canRedo` in the dependency array cause the handler to be re-registered on every slider drag (since each drag pushes history). Not a bug, but wasteful.

**Fix:** Move `canUndo`/`canRedo` into refs inside the hook, so the event handler can read current values without being re-registered:

```ts
const canUndoRef = useRef(canUndo);
const canRedoRef = useRef(canRedo);
useEffect(() => { canUndoRef.current = canUndo; }, [canUndo]);
useEffect(() => { canRedoRef.current = canRedo; }, [canRedo]);
```

Then remove `canUndo`/`canRedo` from the `useEffect` dependency array and read from refs in the handler.

---

## Security

### 13. No path validation on `read-image-buffer` IPC — `src/main/index.ts:169-174`

**Severity:** Depends on threat model

`read-image-buffer` accepts an arbitrary path from the renderer with no validation. With `contextIsolation: true` and `nodeIntegration: false`, this is only exploitable via XSS in the renderer — but if XSS is achieved, any file readable by the process can be exfiltrated.

**Fix:** Maintain a `Set<string>` of paths the user has opened (via dialog or recents). Reject `read-image-buffer` and `get-image-info` calls for paths not in this set:

```ts
const allowedPaths = new Set<string>();

// In open-image handler, after dialog selection:
allowedPaths.add(resolvedPath);

// In read-image-buffer handler:
if (!allowedPaths.has(resolvedPath)) {
  throw new Error('Access denied: path not opened by user');
}
```

---

## Structure

### 14. Document `sandbox: false` — `src/main/index.ts:78`

The renderer sandbox is explicitly disabled without explanation.

**Fix:** Add a comment explaining why:

```ts
sandbox: false, // Required: preload script uses Node.js APIs (path, fs) for IPC bridge
```

### 15. `React.MouseEvent` without explicit import — `src/renderer/hooks/useDraggablePanel.ts:45`

The hook uses `React.MouseEvent` as a type, which works via global types but is fragile.

**Fix:** Use an explicit import:

```ts
import type { MouseEvent } from 'react';
// ...
const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => { ... }, [...]);
```

---

## Component-Level Test Coverage (Medium-Term Roadmap)

The ARCHITECTURE.md medium-term section calls for test coverage of: Canvas, FloatingImage, FloatingCounter, BottomPanel.

### Test strategy

Use the existing vitest + jsdom + @testing-library/react setup (`tests/` directory, `tests/setup.ts`).

Since these components depend on Electron IPC (`window.electronAPI`) and image-js, tests will need mocks for:
- `window.electronAPI` (all 5 methods)
- `image-js` (`readImg`, `Image`, `writeCanvas`)
- `HTMLCanvasElement.getContext` (jsdom doesn't support canvas)
- `ResizeObserver` (jsdom doesn't support it)

Create a shared test setup module (`tests/helpers/mocks.ts`) with reusable mock factories.

### Test files and coverage targets

#### `tests/unit/components/Canvas.test.tsx`

- Renders empty state (placeholder icon + "No image loaded" text) when no image is loaded
- Calls `writeCanvas` when `currentImage` is provided
- Applies correct filter chain in 2-value mode (grey → blur → threshold)
- Applies correct filter chain in 3-value mode (grey → blur → three-zone)
- Shows original image when `showOriginal` is true
- Does not apply filters when blur=0 and threshold=0

#### `tests/unit/components/FloatingImage.test.tsx`

- Renders nothing when `panels.original` is false
- Renders canvas with original image when open
- Toggle button switches between eye-open and eye-closed icons
- Clicking toggle calls `toggleShowOriginal`

#### `tests/unit/components/FloatingCounter.test.tsx`

- Renders nothing when `panels.timer` is false
- Renders preset buttons (1m, 5m, 10m, 15m)
- Clicking preset calls `startCounter` with correct duration
- Displays countdown in MM:SS format
- Start/Stop button toggles between start and stop
- Reset button calls `stopCounter`

#### `tests/unit/components/BottomPanel.test.tsx`

- Renders "Open" and "Save" buttons
- "Open" button triggers file open flow
- "Save" button is disabled when no image is loaded
- Displays file name and dimensions when image is loaded
- Shows minimized panel icons when panels are closed
- Clicking minimized icon reopens the panel
- Status indicator shows correct state (ready/loading/loaded/saving/saved/error)
- Zoom controls display and function correctly

---

## Execution Order

| Step | Files | Description |
|------|-------|-------------|
| 1 | `src/renderer/hooks/useImage.ts` | Fix counter off-by-one (bug #2) |
| 2 | `src/renderer/hooks/useImage.ts` | Extract `DEFAULT_IMAGE_STATE` constant (smell #8) |
| 3 | `src/main/index.ts` | Fix `save-image` null guard (bug #3), empty image check (bug #5), document sandbox (structure #14) |
| 4 | `src/main/index.ts` | Add explicit `isInRecents` guard (smell #11) |
| 5 | `src/main/index.ts` | Add path validation to `read-image-buffer` (security #13) |
| 6 | `src/renderer/workers/imageProcessor.worker.ts` | Add transfer list to error path (bug #4) |
| 7 | `src/renderer/utils/imageConversion.ts` (new), `Canvas.tsx`, `FloatingImage.tsx`, `useImageProcessingWorker.ts` | Extract shared `imageToImageData` utility (smell #6) |
| 8 | `src/shared/types.ts` (new), `main/index.ts`, `global.d.ts`, `GalleryPanel.tsx` | Unify `RecentEntry` type (smell #7) |
| 9 | `src/renderer/constants/ui.ts` | Remove unused `WARN_FILE_BYTES`, `WARN_PIXELS` (smell #9) |
| 10 | `src/renderer/styles.css` | Remove unused CSS custom properties (smell #10) |
| 11 | `src/renderer/hooks/useKeyboardShortcuts.ts` | Use refs for `canUndo`/`canRedo` (smell #12) |
| 12 | `src/renderer/hooks/useDraggablePanel.ts` | Fix `React.MouseEvent` import (structure #15) |
| 13 | `src/renderer/hooks/useImage.ts`, `ImageContext.tsx`, `BottomPanel.tsx` | Fix stale zoom display — lift `effectiveZoom` to context (bug #1) |
| 14 | `tests/helpers/mocks.ts` (new) | Create shared mock factories for electronAPI, image-js, canvas, ResizeObserver |
| 15 | `tests/unit/components/Canvas.test.tsx` (new) | Canvas component tests |
| 16 | `tests/unit/components/FloatingImage.test.tsx` (new) | FloatingImage component tests |
| 17 | `tests/unit/components/FloatingCounter.test.tsx` (new) | FloatingCounter component tests |
| 18 | `tests/unit/components/BottomPanel.test.tsx` (new) | BottomPanel component tests |
| 19 | Verify | `yarn typecheck && yarn test && yarn lint && yarn format:check` |

---

## Files Changed

### Modify

| File | Summary |
|------|---------|
| `src/main/index.ts` | Null guard on save-image, empty image check in addRecentEntry, path validation on read-image-buffer, explicit isInRecents guard, document sandbox: false |
| `src/renderer/hooks/useImage.ts` | Fix counter off-by-one, extract DEFAULT_IMAGE_STATE |
| `src/renderer/hooks/ImageContext.tsx` | Expose `effectiveZoom` as reactive context value |
| `src/renderer/components/shell/BottomPanel.tsx` | Read `effectiveZoom` from context instead of ref |
| `src/renderer/components/Canvas.tsx` | Report `fitScale` to context, use shared imageToImageData |
| `src/renderer/components/FloatingImage.tsx` | Use shared imageToImageData |
| `src/renderer/hooks/useImageProcessingWorker.ts` | Use shared imageToImageData |
| `src/renderer/workers/imageProcessor.worker.ts` | Add transfer list to error-path postMessage |
| `src/renderer/constants/ui.ts` | Remove unused WARN_FILE_BYTES, WARN_PIXELS |
| `src/renderer/styles.css` | Remove unused CSS custom properties |
| `src/renderer/hooks/useKeyboardShortcuts.ts` | Use refs for canUndo/canRedo to reduce re-registrations |
| `src/renderer/hooks/useDraggablePanel.ts` | Use explicit `import type { MouseEvent }` from react |
| `src/renderer/global.d.ts` | Import RecentEntry from shared types |
| `src/renderer/components/shell/GalleryPanel.tsx` | Import RecentEntry from shared types |

### Add

| File | Summary |
|------|---------|
| `src/shared/types.ts` | Single source of truth for `RecentEntry` interface |
| `src/renderer/utils/imageConversion.ts` | Shared `imageToImageData` utility |
| `tests/helpers/mocks.ts` | Shared mock factories for component tests |
| `tests/unit/components/Canvas.test.tsx` | Canvas component tests |
| `tests/unit/components/FloatingImage.test.tsx` | FloatingImage component tests |
| `tests/unit/components/FloatingCounter.test.tsx` | FloatingCounter component tests |
| `tests/unit/components/BottomPanel.test.tsx` | BottomPanel component tests |

---

## Acceptance Criteria

1. Counter stops immediately when it reaches 0 (no extra tick).
2. `save-image` does not crash if `mainWindow` is null.
3. Corrupt/non-image files are not added to recents with blank thumbnails.
4. Worker error path does not cause a full buffer copy on large images.
5. Zoom percentage in BottomPanel updates reactively when the viewport resizes.
6. `RecentEntry` is defined in one place and imported everywhere.
7. Raw-image-to-ImageData conversion exists in one shared utility.
8. No unused constants or CSS custom properties remain.
9. `read-image-buffer` rejects paths not opened by the user.
10. All new component tests pass: Canvas, FloatingImage, FloatingCounter, BottomPanel.
11. `yarn typecheck && yarn test && yarn lint && yarn format:check` all pass.

---

## Risks and Mitigations

- **Shared types across main/renderer**: The `src/shared/` directory is imported at compile time only. Electron's process boundary is IPC — both sides need the types but no runtime code crosses. Verify the tsconfig `include` covers `src/shared/`.
- **Path validation may be too restrictive**: If future features need to read arbitrary paths (e.g. drag-and-drop), the allowed-paths set will need to be expanded. Keep the validation logic centralized in one guard function.
- **Component test mocking complexity**: image-js and canvas mocking may be brittle. Keep mocks minimal — test behavior (what renders, what callbacks fire), not implementation details of image processing.
- **`effectiveZoom` in context**: Adding derived state to context means every zoom change re-renders all consumers. This is acceptable since zoom changes are infrequent (user-initiated), but verify no hot-path components subscribe unnecessarily.
