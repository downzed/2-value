# Large Image Stability & Performance Plan

## Problem

The app can crash or stall when loading larger/high-resolution images, even when file size appears moderate (for example `>~1MB` JPEGs with high pixel count).

Current weak points:

1. **Open path uses base64 data URLs over IPC** (`src/main/index.ts`)  
   `nativeImage.toDataURL()` creates large strings (inflated payload + extra allocations), then renderer decodes again.
2. **Double decode/transform on open** (`OpenDialog`/loader path)  
   Flow is `file -> nativeImage -> dataUrl -> <img> -> image-js`.
3. **Duplicated full-resolution image state** (`src/renderer/hooks/useImage.ts`)  
   `loadImage()` clones image for both `currentImage` and `originalImage`, increasing peak memory.
4. **Heavy processing on UI thread** (`src/renderer/components/Canvas.tsx`)  
   `gaussianBlur` and per-pixel threshold work happen synchronously during interaction.
5. **Multiple full-size canvas renders** (`Canvas` + `FloatingImage`)  
   Both can hold large backing stores.
6. **No guardrails on image dimensions/pixel count**  
   Very large dimensions can enter pipeline and exhaust memory/CPU.

## Goals

- Prevent crashes and OOM conditions when opening large images.
- Keep UI responsive while adjusting controls on high-resolution images.
- Preserve export quality (full-resolution save output).
- Add measurable performance and memory safety checks.

## Non-goals

- Replacing `image-js` entirely.
- Building a full tiling/pyramid editor architecture.
- GPU/WebGL rewrite in this iteration.

---

## Approach

Use an incremental strategy:

1. **Crash prevention first**: remove data URL transport for open flow and add size/pixel guardrails.
2. **Responsiveness second**: progressive processing (fast preview while sliding, full-res settle on debounce).
3. **Scalability third**: move heavy processing work off main thread (worker), with cancellation.
4. **Verification**: benchmark large-image scenarios and enforce acceptance thresholds.

---

## Changes

### 1) Add performance limits and tunables

**File:** `src/renderer/constants/ui.ts`

Add a new block:

```ts
PERF: {
  MAX_FILE_BYTES: 25 * 1024 * 1024,    // hard stop (25MB input file)
  WARN_FILE_BYTES: 10 * 1024 * 1024,   // warn/confirm path
  MAX_PIXELS: 40_000_000,              // hard stop (e.g. 8k x 5k)
  WARN_PIXELS: 20_000_000,
  PREVIEW_MAX_PIXELS: 2_000_000,       // interactive preview target
  INTERACTIVE_DEBOUNCE_MS: 120,
},
```

Notes:
- Values can be tuned after benchmarks.
- `PREVIEW_MAX_PIXELS` is for temporary display processing only, not export.

### 2) Replace open-image data URL transport with binary/descriptor flow

**Files:**
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/global.d.ts`

#### 2a. New IPC contracts

Replace current `open-image` return shape (`{ dataUrl, path }`) with:

```ts
type OpenImageResult = {
  path: string;
  fileName: string;
  fileSize: number;
};
```

Add IPC handlers:

- `get-image-info(path)` -> `{ path, fileName, fileSize }`
- `read-image-buffer(path)` -> `Uint8Array` (or `ArrayBuffer`) for renderer decode

Keep recents behavior unchanged (still updates recents on successful selection/open).

#### 2b. Metadata + file-size preflight in main

Before returning open result:
- `fs.promises.stat(path)` for `fileSize`
- if over `MAX_FILE_BYTES`, return structured error code (no decode)

Rationale:
- Avoid expensive `toDataURL()` and duplicate decode.

### 3) Introduce a single decode path in renderer (`useImageLoader`)

**Files:**
- `src/renderer/hooks/useImageLoader.ts` (new on branches where it does not exist)
- `src/renderer/components/shell/BottomPanel.tsx`
- `src/renderer/components/shell/OpenDialog.tsx` **or** `src/renderer/components/shell/GalleryPanel.tsx` (depending on active UI refactor state)

New decode pipeline:

1. request bytes via `window.electronAPI.readImageBuffer(path)`
2. build `Blob`
3. decode with `createImageBitmap(blob)`
4. convert to `image-js` image (`readImg(bitmap)`)
5. `loadImage(...)`
6. release bitmap (`bitmap.close()`) and any object URL if used

Benefits:
- removes base64 inflation and extra string allocations
- reduces redundant encode/decode work
- keeps one shared loading implementation for all open entry points

### 4) Add pixel-count guardrails after decode metadata is known

**Files:**
- `src/renderer/hooks/useImageLoader.ts`
- `src/renderer/components/shell/BottomPanel.tsx`
- `src/renderer/components/shell/OpenDialog.tsx` or `GalleryPanel.tsx`

Behavior:
- compute `pixels = width * height` after bitmap decode
- hard-fail above `MAX_PIXELS` with user-friendly message
- warn above `WARN_PIXELS` and auto-enable reduced interactive mode

Suggested UI text:
- hard fail: `Image is too large to process safely on this machine.`
- warn: `Large image loaded. Interactive preview mode enabled for performance.`

### 5) Reduce state memory duplication in `useImage`

**File:** `src/renderer/hooks/useImage.ts`

Refactor state so we do not keep two full cloned images by default.

Proposed model:

```ts
sourceImage: Image | null;    // immutable base loaded once
currentImage: Image | null;   // processed result for display/export
```

Rules:
- Do not clone source twice on load.
- Keep source immutable.
- Recompute `currentImage` from source for filter changes.

If original panel needs raw view, render from `sourceImage`.

### 6) Progressive processing for interaction speed

**Files:**
- `src/renderer/components/Canvas.tsx`
- `src/renderer/hooks/useDebouncedCallback.ts` (reuse existing)
- `src/renderer/hooks/useImage.ts` (state flags)

Add two-stage pipeline:

1. **Interactive stage (fast):** while user drags blur/threshold, process a downscaled preview image (capped by `PREVIEW_MAX_PIXELS`).
2. **Settled stage (quality):** after debounce (`INTERACTIVE_DEBOUNCE_MS`), process full-resolution image and swap in.

This keeps slider interactions responsive on large files without sacrificing final quality.

### 7) Offload heavy processing to Web Worker

**Files (new):**
- `src/renderer/workers/imageProcessor.worker.ts`
- `src/renderer/hooks/useImageProcessingWorker.ts`

**Files (modify):**
- `src/renderer/components/Canvas.tsx`

Worker responsibilities:
- receive source pixel data + params (`blur`, `threshold`, `values`)
- run heavy transform steps off main thread
- return processed buffer for canvas draw

Control flow:
- use request id (`jobId`) and "latest-wins" cancellation
- ignore stale results when user changes sliders quickly

Fallback:
- if worker unavailable, keep synchronous path behind feature flag.

### 8) Optimize hot pixel loops

**File:** `src/renderer/components/Canvas.tsx` (or worker module once moved)

Replace method-heavy `applyThreeZones` loop (`getValueByIndex` / `setValueByIndex`) with typed-array operations on raw data buffer for lower overhead.

Expected improvement:
- significantly lower per-pixel function call overhead on large images.

### 9) Save path optimization (remove base64 in save)

**Files:**
- `src/renderer/components/shell/BottomPanel.tsx`
- `src/preload/index.ts`
- `src/main/index.ts`
- `src/renderer/global.d.ts`

Current:
- `canvas.toDataURL('image/png')` then IPC string transport.

Target:
- `canvas.toBlob(...)` -> `ArrayBuffer` -> IPC binary save handler.

Benefits:
- avoids large base64 strings in renderer and main for high-res export.

### 10) Canvas memory hygiene

**Files:**
- `src/renderer/components/Canvas.tsx`
- `src/renderer/components/FloatingImage.tsx`

When replacing large images:
- clear old canvas backing store (`canvas.width = 0; canvas.height = 0` before redraw/reload paths)
- render Original panel only when visible/open
- avoid unnecessary redraws when params unchanged

---

## Execution Order

| Step | Files | Description |
|------|-------|-------------|
| 1 | `ui.ts` | Add `UI.PERF` limits/tunables |
| 2 | `main/index.ts` | Replace open-image payloads; add `get-image-info` + `read-image-buffer` IPC |
| 3 | `preload/index.ts`, `global.d.ts` | Expose/update typed IPC APIs |
| 4 | `useImageLoader.ts` + shell open surfaces | Implement single binary decode path |
| 5 | `useImage.ts` | Remove duplicate full-res image cloning |
| 6 | `Canvas.tsx` | Progressive preview/full-res processing |
| 7 | worker files + `Canvas.tsx` | Off-main-thread processing with cancellation |
| 8 | `Canvas.tsx` (or worker) | Typed-array optimization for three-zone threshold |
| 9 | save-related files | Convert save flow to binary (`toBlob`) transport |
| 10 | canvas components | Add memory hygiene + lazy original panel rendering |
| 11 | tests | Add limits, loader, cancellation, and performance behavior tests |
| 12 | verify | `yarn typecheck && yarn test && yarn lint && yarn format:check` |

---

## Files Changed

### Modify
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/global.d.ts`
- `src/renderer/constants/ui.ts`
- `src/renderer/hooks/useImage.ts`
- `src/renderer/components/Canvas.tsx`
- `src/renderer/components/FloatingImage.tsx`
- `src/renderer/components/shell/BottomPanel.tsx`
- `src/renderer/components/shell/OpenDialog.tsx` **or** `src/renderer/components/shell/GalleryPanel.tsx`

### Add
- `src/renderer/hooks/useImageLoader.ts` (if not already present)
- `src/renderer/workers/imageProcessor.worker.ts`
- `src/renderer/hooks/useImageProcessingWorker.ts`

### Tests
- `tests/unit/hooks/useImage.test.ts`
- new: `tests/unit/hooks/useImageLoader.test.ts`
- new: `tests/unit/hooks/useImageProcessingWorker.test.ts`

---

## Acceptance Criteria

1. Opening large JPEG/PNG no longer crashes due to data URL IPC payload inflation.
2. App remains responsive during slider drag on high-res images (preview updates stay interactive).
3. Final processed render/export remains full-resolution and visually correct.
4. Opening too-large files fails gracefully with actionable messaging (no app crash).
5. Save flow handles large outputs without base64 IPC bottlenecks.

---

## Performance Validation Checklist

Use at least these test images:

- `4K` (~8MP)
- `8K` (~33MP)
- one highly compressed file with small bytes but very large dimensions

Measure before/after:

- open latency (`open` click -> first visible render)
- slider interaction latency (blur/threshold drag)
- peak renderer memory during open and during adjustments
- save latency for large outputs

Target baseline improvements:

- no crashes for images <= `MAX_PIXELS`
- interaction latency under ~`100-150ms` per preview update on 8MP images
- significantly reduced memory spikes during open/save (no base64 transport)

---

## Risks and Mitigations

- **Worker complexity / transfer overhead**  
  Mitigation: ship progressive preview first; add worker with feature-flag fallback.
- **Image format decode differences**  
  Mitigation: retain existing extension filters and verify with png/jpg/jpeg/bmp fixtures.
- **UI flow drift (OpenDialog vs GalleryPanel branch state)**  
  Mitigation: keep loader API reusable and apply to whichever shell open surface is active.

---

## Design Decisions

- **Binary transport over data URL for IPC**: avoids base64 inflation and extra string allocations.
- **Guardrails by bytes and pixels**: file size alone is not enough; dimensions drive memory/CPU cost.
- **Progressive processing**: best UX tradeoff for high-resolution interaction.
- **Worker latest-wins model**: prevents stale heavy jobs from blocking responsiveness.
- **Preserve full-res output**: performance mode affects interaction path, not final export quality.
