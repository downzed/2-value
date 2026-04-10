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

### 3-Value Implementation Fixed ✅
- Implemented proper 3-value halftone that works with threshold slider
- Threshold slider controls the center of the 3 zones
- Range is dynamically calculated as 40% of distance to nearest edge (0 or 255)
- Below threshold-range: black (0)
- Within threshold±range: gray (128)  
- Above threshold+range: white (255)

### Implementation Note
For 3-value halftone effect:
1. Apply blur (as currently done)
2. Convert to greyscale
3. Instead of single threshold, create 3 zones:
   - Below threshold-range: black (0)
   - Within threshold±range: gray (128)  
   - Above threshold+range: white (255)
- Range = min(threshold, 255-threshold) * 0.4 (40% of distance to nearest edge)

---

## Files Modified

| File | Status |
|------|--------|
| `src/renderer/hooks/useImage.ts` | ✅ Done |
| `src/renderer/hooks/ImageContext.tsx` | ✅ Done |
| `src/renderer/components/FloatingControls.tsx` | ✅ Done |
| `src/renderer/components/Canvas.tsx` | ✅ Done |
| `src/renderer/constants/ui.ts` | Not modified |

---

## Testing Notes

- Update tests in `useImage.test.ts` to reflect new state shape
- Remove invert-related tests, add values-related tests
- Tests may currently fail due to state shape changes

---

## Future (Not in Scope)

- Timer panel (3min, 5min, 10min presets)
