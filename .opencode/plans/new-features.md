# Plan: Revert 3-Value, Move Toggle, Add Counter, Remove Toast

## Overview
Revert 3-value mode to original 2-values, move image toggle to FloatingImage header, add counter widget, remove toast notifications.

## Status: COMPLETED ✅

---

## Changes Completed

### 1. Revert 3-Value to Original 2-Values ✅
- Removed `values: 2 | 3` state from useImage.ts and ImageContext.tsx
- Removed 3-value processing logic (posterizeThreeValue) from Canvas.tsx
- Removed 2/3 toggle UI from FloatingControls.tsx
- Threshold slider remains as primary control

### 2. Move Image Toggle to FloatingImage Header ✅
- Removed canvas click toggle from Canvas.tsx
- Added toggle icon button in FloatingImage header
- Added native tooltip "Show Processed"/"Show Original" based on state
- `showOriginal: boolean` state kept in useImage hook
- resetControls resets showOriginal to false

### 3. Add Counter Widget ✅
- Added counter state (counter, counterRunning, counterDuration) to useImage.ts
- Added startCounter(duration) and stopCounter() functions
- Created FloatingCounter.tsx with timer presets (1m, 5m, 10m, 15m)
- Counter auto-stops when reaching duration

### 4. Remove Toast Completely ✅
- Removed useToast imports and showToast() calls from BottomPanel.tsx
- Removed ToastProvider from App.tsx
- Status information (ready/loading/loaded/saving/saved/error) remains in BottomPanel

---

## Files Modified
- `src/renderer/hooks/useImage.ts` - Removed values state, added counter state
- `src/renderer/hooks/ImageContext.tsx` - Updated context interface
- `src/renderer/components/Canvas.tsx` - Removed 3-value logic, canvas click toggle
- `src/renderer/components/FloatingControls.tsx` - Removed 2/3 toggle UI
- `src/renderer/components/FloatingImage.tsx` - Added toggle icon in header
- `src/renderer/components/BottomPanel.tsx` - Removed toast imports/calls
- `src/renderer/components/App.tsx` - Removed ToastProvider, added FloatingCounter
- `src/renderer/components/FloatingCounter.tsx` - NEW: Timer widget
- `tests/unit/hooks/useImage.test.ts` - Updated tests

---

## Counter Widget Specification

### Timer Presets
- 1 minute (60 seconds)
- 5 minutes (300 seconds)
- 10 minutes (600 seconds)
- 15 minutes (900 seconds)

### UI Layout
- Preset buttons (1m, 5m, 10m, 15m)
- Start/Stop button (toggles between green "Start" and red "Stop")
- Reset button
- Counter display showing seconds elapsed

### Counter State (in useImage.ts)
- `counter: number` - current count (seconds elapsed)
- `counterRunning: boolean` - timer active
- `counterDuration: number | null` - selected duration in seconds
- `startCounter(duration: number)` - start timer with preset
- `stopCounter()` - stop timer

### Behavior
- When timer reaches duration, auto-stops
- Counter displays seconds elapsed
- Reset clears counter and stops timer
- FloatingCounter position persisted to localStorage

---

## Testing Verified
- [x] useImage.test.ts passes with new state shape
- [x] Canvas click no longer toggles image
- [x] FloatingImage header toggle works correctly
- [x] Counter widget displays and updates
- [x] No toast notifications appear
- [x] All statuses show in BottomPanel