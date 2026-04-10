---
name: ui-refactor
description: Refactor all existing renderer components to use the shared UI primitives (Icon, PillButton, SectionHeader, SliderRow) created by the shared-components skill. Phase 3 of the gallery-save-refactor plan.
---

## What I do

Refactor 6 existing components to replace inline SVGs, duplicated button styles, section headers, and slider rows with the shared components from `src/renderer/components/shared/`. This is Phase 3 of `.opencode/plans/gallery-save-refactor-plan.md`.

## When to use me

Use this skill after the `shared-components` skill (Phase 2) is complete and `yarn typecheck` passes. The 4 shared components must exist before starting.

## Prerequisites

- `src/renderer/components/shared/Icon.tsx` exists and exports `Icon` + `IconName`
- `src/renderer/components/shared/PillButton.tsx` exists and exports `PillButton`
- `src/renderer/components/shared/SectionHeader.tsx` exists and exports `SectionHeader`
- `src/renderer/components/shared/SliderRow.tsx` exists and exports `SliderRow`
- `yarn typecheck` passes

## Steps

### 1. Refactor `FloatingPanel.tsx`

**Replace:** The inline close button SVG (lines 69-72) with `<Icon name="close" size="md" />`.

**Add import:** `import { Icon } from './shared/Icon';`

**Before:**
```tsx
<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
  <title>close</title>
  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
</svg>
```

**After:**
```tsx
<Icon name='close' />
```

### 2. Refactor `FloatingControls.tsx`

This component has the most replacements.

**Add imports:**
```ts
import { Icon } from './shared/Icon';
import { PillButton } from './shared/PillButton';
import { SectionHeader } from './shared/SectionHeader';
import { SliderRow } from './shared/SliderRow';
```

**Replace section headers** (3 instances):
- Line 87: `<span className='text-[10px]...'>Presets</span>` → `<SectionHeader>Presets</SectionHeader>`
- Line 109: same pattern → `<SectionHeader>Adjustments</SectionHeader>`
- Line 184: same pattern → `<SectionHeader>History</SectionHeader>`

**Replace preset buttons** (the `.map()` block, lines 89-102):
Each preset button becomes `<PillButton onClick={...} disabled={!hasImage} active={isPresetActive(preset)}>{preset.name}</PillButton>`.

**Replace slider rows** (2 instances):
- Blur slider (lines 111-127) → `<SliderRow label='Blur' id='blur-range' min={UI.FILTER.BLUR_MIN} max={UI.FILTER.BLUR_MAX} step={UI.FILTER.BLUR_STEP} value={localBlur} onChange={handleBlurChange} disabled={!hasImage} valueWidth='w-6' />`
- Threshold slider (lines 129-144) → `<SliderRow label='Thresh' id='thresh-range' min={UI.FILTER.THRESHOLD_MIN} max={UI.FILTER.THRESHOLD_MAX} step={UI.FILTER.THRESHOLD_STEP} value={localThreshold} onChange={handleThresholdChange} disabled={!hasImage} parseValue={v => parseInt(v, 10)} />`

**Replace undo/redo buttons** (lines 186-222):
Each becomes a `<PillButton>` wrapping an `<Icon>`:
```tsx
<PillButton onClick={undo} disabled={!canUndo} className='flex items-center gap-1'>
  <Icon name='undo' size='sm' />
  Undo
</PillButton>
```
Same pattern for Redo with `<Icon name='redo' size='sm' />` after the text.

**Keep unchanged:** The 2/3 value toggle buttons (segmented control) — these have a different visual pattern (`bg-white shadow` active state) and are not a good fit for PillButton.

### 3. Refactor `FloatingImage.tsx`

**Replace:** The two inline eye SVGs (lines 49-70) with `<Icon>` components.

**Add import:** `import { Icon } from './shared/Icon';`

**Before (eye-open, lines 49-57):**
```tsx
<svg className='w-4 h-4' ...>
  <title>processed</title>
  <path ... d='M15 12a3 3 0 11-6 0 ...' />
  <path ... d='M2.458 12C3.732 ...' />
</svg>
```

**After:**
```tsx
<Icon name='eye-open' />
```

Same for the eye-closed icon (lines 60-67) → `<Icon name='eye-closed' />`.

### 4. Refactor `FloatingCounter.tsx`

**Replace:** Timer preset buttons (lines 38-52) and Start/Stop/Reset buttons (lines 63-83) with `<PillButton>`.

**Add import:** `import { PillButton } from './shared/PillButton';`

**Timer preset buttons:** Each becomes:
```tsx
<PillButton
  onClick={() => startCounter(preset.seconds)}
  disabled={counterRunning}
  active={counterDuration === preset.seconds && !counterRunning}
>
  {preset.label}
</PillButton>
```

**Start/Stop button:** This button has colored variants (`bg-red-500` / `bg-emerald-500`) that don't match PillButton's active/inactive pattern. Two options:
- (a) Add a `variant` prop to PillButton (danger/success). More general.
- (b) Keep this button inline and only replace the preset + reset buttons.

**Recommendation:** Option (b) — keep Start/Stop inline. Only replace the 4 timer preset buttons and the Reset button with `<PillButton size='md'>`.

### 5. Refactor `Canvas.tsx`

**Replace:** The empty-state placeholder SVG (lines 48-56) with `<Icon>`.

**Add import:** `import { Icon } from './shared/Icon';`

**Before:**
```tsx
<svg className='w-12 h-12 text-slate-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
  <title>empty-image</title>
  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M4 16l4.586...' />
</svg>
```

**After:**
```tsx
<Icon name='image' size='lg' className='text-slate-400' strokeWidth={1.5} />
```

Note the `strokeWidth={1.5}` override — the empty state uses 1.5 while the default is 2.

### 6. Refactor `BottomPanel.tsx`

**Replace:** The 3 minimized panel restore button SVGs (lines 136-179) with `<Icon>`.

**Add import:** `import { Icon } from './shared/Icon';`

- Controls icon → `<Icon name='sliders' size='sm' />`
- Original icon → `<Icon name='image' size='sm' />`
- Timer icon → `<Icon name='clock' size='sm' />`

The button wrapper elements and their classNames stay unchanged — only the inline `<svg>...</svg>` blocks are replaced.

### 7. Verify

Run the full verification suite:

```bash
yarn typecheck && yarn test && yarn lint && yarn format:check
```

All 34 existing tests must pass. No behavioral changes — this is a pure refactor.

## Important notes

- This is a **pure refactor**. No behavioral changes. Every component must render identically before and after.
- The 2/3 value toggle in FloatingControls and the Start/Stop button in FloatingCounter are intentionally NOT replaced — their visual patterns differ from PillButton.
- When replacing SVGs with `<Icon>`, make sure the surrounding button/container classNames (like `text-slate-400 hover:text-slate-600 transition-colors`) are preserved on the parent element.
- The `Icon` component's `size='sm'` maps to `w-3.5 h-3.5`, which matches the existing BottomPanel icon sizes. Verify visually if possible.
- Run `yarn dev` and manually check that panels, buttons, and icons look identical to before the refactor.
