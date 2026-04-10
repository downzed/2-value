# Plan: Revert 3-Value, Move Toggle, Add Counter, Remove Toast

## Overview
Revert 3-value mode to original 2-values, move image toggle to FloatingImage header, add counter widget, remove toast notifications.

---

## Changes Needed

### 1. Revert 3-Value to Original 2-Values
- Remove `values: 2 | 3` state and revert to binary threshold only
- Remove 3-value processing logic from Canvas.tsx
- Update UI controls to remove 2/3 toggle
- Keep threshold slider as primary control

### 2. Move Image Toggle to FloatingImage Header
- Remove canvas click toggle (`onClick={toggleShowOriginal}` in Canvas.tsx)
- Add toggle icon/button in FloatingImage header
- Add native tooltip to show "Show Processed"/"Show Original" based on state
- Keep `showOriginal: boolean` state in useImage hook
- Update resetControls to reset showOriginal to false

### 3. Add Counter Widget
- Add counter state to track image processing operations or similar metric
- Display counter in BottomPanel or new UI element
- Increment counter on meaningful operations (to be defined)

### 4. Remove Toast Completely
- Remove `useToast` hook and all `showToast()` calls
- Verify all status information appears in BottomPanel
- Ensure BottomPanel shows appropriate status for all operations

---

## Files to Modify
- `src/renderer/hooks/useImage.ts` - Revert values state, keep showOriginal
- `src/renderer/components/Canvas.tsx` - Remove 3-value logic, remove canvas click toggle
- `src/renderer/components/FloatingControls.tsx` - Remove 2/3 toggle UI
- `src/renderer/components/FloatingImage.tsx` - Add toggle icon in header with tooltip
- `src/renderer/components/BottomPanel.tsx` - Remove toast imports/calls, ensure status display
- `src/renderer/hooks/useToast.ts` - Remove file if no longer used elsewhere
- Tests - Update to reflect state changes

---

## Implementation Notes

### 3-Value Reversion
- Simplify Canvas.tsx processing to: blur → threshold (if > 0) → display
- Remove posterizeThreeValue function entirely
- Threshold slider remains as primary adjustment control

### FloatingImage Toggle
- Add icon button in header div (between draggable area and close button)
- Icon should indicate toggle state (eye/open/closed or similar)
- Use native title attribute for tooltip
- onClick handler calls toggleShowOriginal from context

### Counter Widget
- Need to define what to count (filters applied? saves? loads?)
- For now, add placeholder that can be expanded later

### Status Display
- BottomPanel already shows: ready/loading/loaded/saving/saved/error
- Verify these cover all user-facing operations
- Remove toast duplicates of these statuses

---

## Testing Considerations
- Update useImage.test.ts for reverted state shape
- Verify canvas click no longer toggles image
- Verify FloatingImage header toggle works correctly
- Verify counter appears and updates appropriately
- Verify no toast notifications appear
- Verify all statuses show in BottomPanel