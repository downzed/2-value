---
name: shared-components
description: Create the 4 shared UI primitives (Icon, PillButton, SectionHeader, SliderRow) in src/renderer/components/shared/ as specified in Phase 2 of the gallery-save-refactor plan.
---

## What I do

Create 4 new shared UI primitive components under `src/renderer/components/shared/`. These are extracted from duplicated patterns identified across the codebase. This skill covers Phase 2 of `.opencode/plans/gallery-save-refactor-plan.md` — creation only, not refactoring existing consumers.

## When to use me

Use this skill when implementing Phase 2 of the gallery-save-refactor plan. Run this BEFORE the `ui-refactor` skill (Phase 3), which depends on these components existing.

## Prerequisites

- Phase 1 (foundation: `useImage.ts` filePath addition, IPC changes) should be done first, or at minimum `yarn typecheck` should pass before starting.

## Steps

### 1. Create `src/renderer/components/shared/Icon.tsx`

SVG icon wrapper with an icon path registry.

**Props:**

```ts
interface IconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  strokeWidth?: number;
}
```

**Size mapping:** `sm` = `w-3.5 h-3.5`, `md` = `w-4 h-4` (default), `lg` = `w-12 h-12`.

**Icon registry** — a `Record<IconName, string | string[]>` mapping names to SVG `d` path data. Multi-path icons use `string[]`. Source the exact path data from the existing inline SVGs:

| Name | Source file | Lines |
|------|-------------|-------|
| `close` | `FloatingPanel.tsx` | 70-71 |
| `sliders` | `BottomPanel.tsx` | 139-142 |
| `image` | `BottomPanel.tsx` | 158-160 (same path in `Canvas.tsx:51-54`) |
| `clock` | `BottomPanel.tsx` | 175-178 |
| `eye-open` | `FloatingImage.tsx` | 51-57 (2 paths) |
| `eye-closed` | `FloatingImage.tsx` | 63-67 (1 path) |
| `undo` | `FloatingControls.tsx` | 196-199 |
| `redo` | `FloatingControls.tsx` | 214-218 |

**Renders:**

```tsx
<svg className={sizeClass + ' ' + (className ?? '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <title>{name}</title>
  {paths.map(d => (
    <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth ?? 2} d={d} />
  ))}
</svg>
```

Export `IconName` type for consumers.

### 2. Create `src/renderer/components/shared/PillButton.tsx`

Small rounded button with active/inactive/disabled states.

**Props:**

```ts
interface PillButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}
```

**Styles:**
- Base: `text-xs font-medium rounded disabled:opacity-40 disabled:cursor-not-allowed`
- Size `sm` (default): `px-2 py-1`
- Size `md`: `px-3 py-1`
- Active: `bg-slate-700 text-white`
- Inactive: `bg-slate-100 text-slate-600 hover:bg-slate-200`
- Additional `className` appended for one-off overrides (e.g. undo/redo `flex items-center gap-1`).

### 3. Create `src/renderer/components/shared/SectionHeader.tsx`

Uppercase section label.

**Props:**

```ts
interface SectionHeaderProps {
  children: React.ReactNode;
}
```

**Renders:** `<span className='text-[10px] uppercase tracking-wider text-slate-400 font-semibold'>{children}</span>`

### 4. Create `src/renderer/components/shared/SliderRow.tsx`

Label + range input + value display row.

**Props:**

```ts
interface SliderRowProps {
  label: string;
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  valueWidth?: string;
  parseValue?: (raw: string) => number;
}
```

**Renders:**

```tsx
<div className="flex items-center gap-2">
  <label htmlFor={id} className="text-xs font-medium text-slate-600 w-14">{label}</label>
  <input
    id={id}
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={e => onChange((parseValue ?? parseFloat)(e.target.value))}
    disabled={disabled}
    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
  />
  <span className={`text-xs text-slate-500 ${valueWidth ?? 'w-8'} text-right`}>{value}</span>
</div>
```

### 5. Verify

Run `yarn typecheck` to confirm all 4 components compile. No tests needed for this phase — the components are not yet consumed.

## Important notes

- Do NOT modify any existing components in this phase. That is Phase 3 (`ui-refactor` skill).
- Copy SVG path `d` values exactly from the source files — do not approximate or retype them.
- All components must use single quotes for JSX string attributes (Biome formatter convention in this project).
- Run `yarn lint && yarn format:check` after creation to catch any formatting issues.
