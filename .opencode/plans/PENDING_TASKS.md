# Image Editor - Pending Tasks Plan

**Created:** April 8, 2026  
**Last Updated:** April 8, 2026  
**Status:** In Progress

---

## Quick Stats
- **Total Pending Tasks:** 5
- **High Priority:** 1
- **Medium Priority:** 2
- **Low Priority:** 2

---

## ✅ Completed (from CODEBASE_ANALYSIS.md)

- [x] Extract `useDraggablePanel()` hook
- [x] Debounce slider changes
- [x] Remove unused `vite.config.ts`
- [x] Replace `fs.writeFileSync()` with async
- [x] Extract magic numbers to constants (`src/renderer/constants/ui.ts`)
- [x] Add Toast error/success UI
- [x] Remove `showKey` hack from FloatingImage
- [x] Clean up FloatingImage (remove unnecessary useState)

---

## Pending Tasks

### High Priority

#### 1. Add useMemo to Canvas Filter Pipeline
**Priority:** HIGH | **Effort:** 15 min | **Impact:** Prevents redundant filter calculations

**Location:** `src/renderer/components/Canvas.tsx`

**Current Code:**
```typescript
useEffect(() => {
  if (!currentImage || !previewCanvasRef.current) return;
  let processed: Image | Mask | null = currentImage;
  // ... filter pipeline runs every render
}, [currentImage, blur, threshold, invert, previewCanvasRef]);
```

**Solution:**
```typescript
const processed = useMemo(() => {
  if (!currentImage) return null;
  let result: Image | Mask = currentImage;
  if (threshold > 0) result = result.grey() as Image;
  if (blur > 0) result = result.gaussianBlur({ sigma: blur });
  if (threshold > 0) result = result.threshold({ threshold: threshold / 255 });
  if (invert) result = result.invert();
  return result;
}, [currentImage, blur, threshold, invert]);

useEffect(() => {
  if (!processed || !previewCanvasRef.current) return;
  writeCanvas(processed, previewCanvasRef.current);
}, [processed, previewCanvasRef]);
```

**Acceptance Criteria:**
- Filter pipeline only recalculates when dependencies change
- Canvas renders correctly with all filter combinations
- No visual regression

---

### Medium Priority

#### 2. Complete Biome Linting Config
**Priority:** MEDIUM | **Effort:** 30 min | **Impact:** Better code quality enforcement

**Location:** `biome.json`

**Current State:** Formatter only, no linting rules

**Solution:** Add linting rules:
```json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn",
        "noDebugger": "warn"
      }
    }
  }
}
```

**Acceptance Criteria:**
- `yarn lint` passes without errors
- No new lint warnings introduced

---

#### 3. Add Unit Tests
**Priority:** MEDIUM | **Effort:** 4-6 hours | **Impact:** 40% coverage, prevent regressions

**Test Files to Create:**
```
tests/
├── unit/
│   ├── hooks/
│   │   ├── useDraggablePanel.test.ts
│   │   └── useImage.test.ts
│   └── utils/
│       └── debounce.test.ts
├── setup.ts
└── vitest.config.ts
```

**Testing Stack:**
- Vitest
- React Testing Library

**Acceptance Criteria:**
- Core hooks tested (useImage, useDraggablePanel)
- All tests pass
- CI/CD ready

---

### Low Priority

#### 4. Optimize Image Loading
**Priority:** LOW | **Effort:** 30 min | **Impact:** Cleaner code

**Location:** `src/renderer/components/BottomPanel.tsx`

**Current Code:**
```typescript
const img = new window.Image();
await new Promise<void>((resolve, reject) => {
  img.onload = () => resolve();
  img.onerror = () => reject(new Error("Failed to load image element"));
  img.src = result.dataUrl;
});
const image = readImg(img);
```

**Issue:** Creates intermediate `window.Image` element unnecessarily

**Note:** Depends on whether `image-js` `readImg()` supports direct dataURL input. If not, current approach is fine.

---

#### 5. Simplify ImageContext
**Priority:** LOW | **Effort:** 15 min | **Impact:** Minor refactor

**Location:** `src/renderer/hooks/ImageContext.tsx`

**Current State:** Context just wraps `useImage` with no additional logic

**Options:**
1. Inline into App.tsx if no other providers needed
2. Combine with `useImage.ts` if reusing elsewhere

**Note:** Low impact, can be revisited later

---

## File Structure (Current)

```
src/
├── main/
│   └── index.ts ✅ Async save
├── preload/
│   └── index.ts
├── renderer/
│   ├── components/
│   │   ├── App.tsx ✅ ToastProvider
│   │   ├── BottomPanel.tsx ✅ Status + Toasts
│   │   ├── Canvas.tsx ⬜ useMemo pending
│   │   ├── FloatingControls.tsx ✅ useDraggablePanel
│   │   └── FloatingImage.tsx ✅ Cleaned up
│   ├── hooks/
│   │   ├── ImageContext.tsx
│   │   ├── useDraggablePanel.ts ✅
│   │   ├── useImage.ts
│   │   └── useToast.tsx ✅
│   ├── constants/
│   │   └── ui.ts ✅
│   └── utils/
│       └── debounce.ts ✅
```

---

## Implementation Order

1. **useMemo for Canvas** (15 min) - High impact, quick win
2. **Biome linting config** (30 min) - Code quality
3. **Unit tests** (4-6 hours) - Regression prevention
4. **Image loading optimization** (30 min) - If needed
5. **ImageContext simplification** (15 min) - Low priority

---

## Notes

- `vite.config.ts` already doesn't exist (no cleanup needed)
- Async file save already implemented in `src/main/index.ts`
- Toast system already implemented via `useToast` hook