# Plan: 3-Value Mode, Image Toggle, Remove Debounce

## Overview

Add 3-value (halftone) mode, image toggle on canvas click, and remove debounce for real-time response.

---

## Completed

### 1. Replace Invert with Values Toggle ✅
- `values: 2 | 3` in useImage hook
- Removed `invert` entirely

### 2. Image Toggle (Original ↔ Processed) ✅
- Click on main canvas toggles between original and processed
- `showOriginal: boolean` in useImage hook
- `resetControls()` resets `showOriginal` to `false`

### 3. Remove Debounce ✅
- Removed debounce from blur/threshold sliders
- Real-time response now

### 4. UI Updates ✅
- FloatingControls.tsx: Replaced invert checkbox with 2/3 pill toggle
- Threshold slider still visible (not disabled when values=3)

---

## Issues / Needs Fix

### 3-Value Implementation is Broken
- Current implementation uses manual pixel manipulation which results in pixelated/broken output
- **Keep Threshold slider working alongside 3-value mode** - they are complementary
- Need to implement proper 3-value halftone:
  - Option A: Use two thresholds (black→gray at lower threshold, gray→white at upper threshold)
  - Option B: Use blur + threshold to create smooth halftone transitions
  - Option C: Apply threshold first, then create a mid-tone band around the threshold boundary

### Implementation Note
For 3-value halftone effect:
1. Apply blur (as currently done)
2. Convert to greyscale
3. Instead of single threshold, create 3 zones:
   - Below threshold: black (0)
   - Within threshold ± range: gray (128)  
   - Above threshold: white (255)
- The "range" could be controlled by the threshold value itself (e.g., threshold = 128, range = 20)

---

## Files Modified

| File | Status |
|------|--------|
| `src/renderer/hooks/useImage.ts` | ✅ Done |
| `src/renderer/hooks/ImageContext.tsx` | ✅ Done |
| `src/renderer/components/FloatingControls.tsx` | ✅ Done |
| `src/renderer/components/Canvas.tsx` | ⚠️ Needs fix |
| `src/renderer/constants/ui.ts` | Not modified |

---

## Testing Notes

- Update tests in `useImage.test.ts` to reflect new state shape
- Remove invert-related tests, add values-related tests
- Tests may currently fail due to state shape changes

---

## Future (Not in Scope)

- Timer panel (3min, 5min, 10min presets)
