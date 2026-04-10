# Gallery, Save Formats & UI Refactor

## Overview

Three tracks:

- **Track A** — Local gallery / recent images: Replace the native OS file dialog with a custom in-app dialog that shows recent images and an "Upload new" option.
- **Track B** — Multi-format save: Fix the save pipeline so the output format matches the chosen extension (or defaults to the original file's format). Currently everything is saved as PNG bytes regardless of extension.
- **Track C** — UI refactor: Extract duplicated UI primitives into shared components and reorganize the component directory structure.

---

## Track A: Local Gallery / Recent Images

### Goal

When the user clicks "Open" (or presses Ctrl+O), instead of going straight to the native OS file picker, show a custom in-app dialog with two sections:

1. **Recents** — Thumbnails of previously opened images (most recent first), stored persistently.
2. **Browse...** button — Falls through to the existing native `dialog.showOpenDialog` flow.

Clicking a recent thumbnail reopens that image directly (no file picker).

### Architecture

#### New IPC channels

| Channel | Direction | Payload | Returns |
|---------|-----------|---------|---------|
| `get-recents` | renderer → main | — | `RecentEntry[]` |
| `add-recent` | renderer → main | `{ path: string }` | `void` |
| `remove-recent` | renderer → main | `{ path: string }` | `void` |
| `open-image-from-path` | renderer → main | `{ path: string }` | `{ dataUrl: string; path: string } \| null` |

`open-image` (existing) — unchanged, still opens the native dialog.

#### `RecentEntry` type

```ts
interface RecentEntry {
  path: string;       // Absolute path on disk
  fileName: string;   // Basename (e.g. "photo.jpg")
  thumbnail: string;  // Base64 data URL (small, ~100px wide)
  openedAt: number;   // Date.now() timestamp of last open
}
```

#### Main process changes (`src/main/index.ts`)

- **Recents storage**: Use `electron-store` or a plain JSON file at `app.getPath('userData')/recents.json`. Max 20 entries. Deduplicate by `path`. On add, if entry exists, update `openedAt` and `thumbnail`. Sorted by `openedAt` desc.
- **Thumbnail generation**: When adding a recent, use `nativeImage.createFromPath(path).resize({ width: 100 })` to create a small thumbnail, then `.toDataURL()`. Store the thumbnail data URL in the JSON.
- **`open-image-from-path` handler**: Given a path, check `fs.existsSync(path)`. If missing, remove from recents and return `null`. Otherwise, load via `nativeImage.createFromPath`, return `{ dataUrl, path }` (same shape as existing `open-image`).
- **Existing `open-image` handler**: After a successful open, call the add-recent logic internally (so the native-dialog path also populates recents).

#### Preload changes (`src/preload/index.ts`)

Expose 4 new methods on `electronAPI`:

```ts
getRecents: () => ipcRenderer.invoke('get-recents'),
addRecent: (path: string) => ipcRenderer.invoke('add-recent', { path }),
removeRecent: (path: string) => ipcRenderer.invoke('remove-recent', { path }),
openImageFromPath: (path: string) => ipcRenderer.invoke('open-image-from-path', { path }),
```

Update `global.d.ts` accordingly.

#### Renderer changes

**New component: `src/renderer/components/OpenDialog.tsx`**

A modal/overlay that renders:

```
┌──────────────────────────────────────────┐
│  Open Image                         [X]  │
├──────────────────────────────────────────┤
│                                          │
│  RECENTS                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │thumb│ │thumb│ │thumb│ │thumb│  ...    │
│  │name │ │name │ │name │ │name │        │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
│                                          │
│  ─────────────────────────────────────── │
│                                          │
│  [Browse Files...]                       │
│                                          │
└──────────────────────────────────────────┘
```

- Grid of thumbnail cards. Each card shows the thumbnail image, filename below, and a small "×" to remove from recents on hover.
- "Browse Files..." button triggers the existing `window.electronAPI.openImage()` (native dialog) flow.
- Clicking a thumbnail calls `window.electronAPI.openImageFromPath(path)`.
- Both paths converge to the same `loadImage(image, fileName)` call.
- If a recent file no longer exists on disk, show a "File not found" toast/state and remove it from recents.
- Modal closes on Escape, backdrop click, or after image load.

**State**: The dialog open/closed state lives in `BottomPanel` (or lifted to context if needed). `Ctrl+O` opens the dialog instead of directly opening the native picker.

**Recents fetch**: `OpenDialog` calls `window.electronAPI.getRecents()` on mount.

### State changes in `useImage.ts`

Add `filePath: string` (full absolute path) alongside the existing `fileName`. This is needed for Track B (save) to know the original extension/path. Set it in `loadImage()`, clear in `resetImage()`.

**`loadImage` signature changes:**

```ts
loadImage(image: Image, fileName: string, filePath: string): void
```

BottomPanel (and OpenDialog) will pass the full path from the IPC result. The `filePath` is also used by the save flow to derive the default save path and extension.

---

## Track B: Multi-Format Save

### Problem

The save handler in `main/index.ts` always calls `image.toPNG()` regardless of the extension the user chose in the save dialog. If the user saves as `.jpg`, the file contains PNG bytes with a `.jpg` extension.

Additionally:
- The default save filename is hardcoded to `untitled.png` instead of using the original filename.
- The renderer always serializes the canvas as `canvas.toDataURL('image/png')`.

### Solution

#### Main process changes (`src/main/index.ts`)

**Updated `save-image` IPC handler:**

Accepts: `{ dataUrl: string; defaultPath?: string }` (add `defaultPath`).

```ts
ipcMain.handle('save-image', async (_event, { dataUrl, defaultPath }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Image',
    defaultPath: defaultPath || 'untitled.png',
    filters: [
      { name: 'PNG', extensions: ['png'] },
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'BMP', extensions: ['bmp'] },
    ],
  });
  if (canceled || !filePath) return null;

  const image = nativeImage.createFromDataURL(dataUrl);
  const ext = path.extname(filePath).toLowerCase();

  let buffer: Buffer;
  if (ext === '.jpg' || ext === '.jpeg') {
    buffer = image.toJPEG(90); // quality 0-100
  } else if (ext === '.bmp') {
    buffer = image.toBitmap(); // raw bitmap; may need manual BMP header — investigate nativeImage API
  } else {
    buffer = image.toPNG();
  }

  await fs.promises.writeFile(filePath, buffer);
  return filePath;
});
```

**Note on BMP:** Electron's `nativeImage.toBitmap()` returns raw pixel data without BMP headers. Two options:
1. Drop BMP from the save dialog (keep it in open only). Simpler.
2. Use `sharp` or manual BMP header construction. More work for a rarely-used format.

Recommendation: Drop BMP from save. Support PNG and JPEG only for save. Keep BMP in open (Electron's `nativeImage.createFromPath` handles BMP reading fine).

#### Preload changes

Update `saveImage` signature:

```ts
saveImage: (dataUrl: string, defaultPath?: string) => ipcRenderer.invoke('save-image', { dataUrl, defaultPath }),
```

Update `global.d.ts`.

#### Renderer changes (`BottomPanel.tsx`)

- Pass `filePath` from context as `defaultPath` to `saveImage`. If `filePath` is `/home/user/photo.jpg`, the save dialog defaults to that path and extension.
- The canvas serialization (`canvas.toDataURL('image/png')`) stays as PNG — this is just the transport format over IPC. The main process re-encodes to the target format via `nativeImage`.

---

## Track C: UI Refactor — Extract Shared Components

### Current code smells identified

| # | Smell | Occurrences | Files |
|---|-------|-------------|-------|
| 1 | Inline SVG icons with repeated boilerplate (`fill='none' stroke='currentColor' viewBox='0 0 24 24'` + stroke attributes) | 10 icons | FloatingPanel, FloatingImage, FloatingControls, BottomPanel, Canvas |
| 2 | Small pill button style (`px-2 py-1 text-xs font-medium rounded ... disabled:opacity-40 disabled:cursor-not-allowed`) with active/inactive variants | 6+ | FloatingControls, FloatingCounter |
| 3 | Section header style (`text-[10px] uppercase tracking-wider text-slate-400 font-semibold`) | 3 | FloatingControls |
| 4 | Slider row pattern (label + range input + value display) | 2 | FloatingControls |
| 5 | Minimized panel restore button pattern in bottom bar (`w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 ...`) | 3 | BottomPanel |
| 6 | `disabled:opacity-40 disabled:cursor-not-allowed` fragment | 8 | FloatingControls, FloatingCounter, BottomPanel |
| 7 | Image/photo SVG path duplicated (exact same `d` string) | 2 | Canvas, BottomPanel |

### New directory structure

```
src/renderer/
├── components/
│   ├── shared/              ← NEW: reusable UI primitives
│   │   ├── Icon.tsx         ← SVG icon wrapper + icon registry
│   │   ├── PillButton.tsx   ← Small button with active/inactive/disabled states
│   │   ├── SectionHeader.tsx ← Uppercase section label
│   │   └── SliderRow.tsx    ← Label + range input + value display
│   ├── shell/               ← NEW: app-level layout components
│   │   ├── App.tsx          ← (move from components/)
│   │   ├── BottomPanel.tsx  ← (move from components/)
│   │   └── OpenDialog.tsx   ← NEW: gallery/recent images dialog
│   ├── Canvas.tsx           ← stays (core feature, not shell, not shared)
│   ├── FloatingPanel.tsx    ← stays (panel framework)
│   ├── FloatingControls.tsx ← stays (feature panel)
│   ├── FloatingImage.tsx    ← stays (feature panel)
│   └── FloatingCounter.tsx  ← stays (feature panel)
├── hooks/
├── constants/
└── ...
```

### Shared component specs

#### `Icon.tsx`

```ts
interface IconProps {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';   // sm=3.5, md=4, lg=12 (in Tailwind w-/h- units)
  className?: string;            // Extra classes (color overrides, etc.)
  strokeWidth?: number;          // Default: 2
}
```

Icon registry — a `Record<IconName, string>` mapping icon names to SVG `d` path data:

| Name | Used in | Path source |
|------|---------|-------------|
| `close` | FloatingPanel | `M6 18L18 6M6 6l12 12` |
| `sliders` | BottomPanel | Controls/sliders path |
| `image` | BottomPanel, Canvas | Image/photo path |
| `clock` | BottomPanel | Clock path |
| `eye-open` | FloatingImage | Eye-open path |
| `eye-closed` | FloatingImage | Eye-closed path |
| `undo` | FloatingControls | Undo arrow path |
| `redo` | FloatingControls | Redo arrow path |

Some icons have multiple `<path>` elements (e.g. `eye-open`). The registry value should be `string | string[]` to handle multi-path icons.

The component renders:
```tsx
<svg className={sizeClass + ' ' + className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
  <title>{name}</title>
  {paths.map(d => <path key={d} strokeLinecap='round' strokeLinejoin='round' strokeWidth={strokeWidth} d={d} />)}
</svg>
```

#### `PillButton.tsx`

```ts
interface PillButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;              // true = bg-slate-700 text-white
  size?: 'sm' | 'md';           // sm = px-2 py-1, md = px-3 py-1
  className?: string;
}
```

Consolidates the 6+ pill button instances across FloatingControls and FloatingCounter. The undo/redo buttons use this too (with Icon as children).

#### `SectionHeader.tsx`

```ts
interface SectionHeaderProps {
  children: React.ReactNode;
}
```

Renders: `<span className='text-[10px] uppercase tracking-wider text-slate-400 font-semibold'>{children}</span>`

Replaces 3 inline instances in FloatingControls. OpenDialog will also use it for "Recents" header.

#### `SliderRow.tsx`

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
  valueWidth?: string;           // Tailwind width class for value display (default: 'w-8')
  parseValue?: (raw: string) => number; // Default: parseFloat
}
```

Replaces the 2 duplicated slider rows in FloatingControls.

### Shell components

#### Moving `App.tsx` → `shell/App.tsx`

The root component that sets up providers and composes the layout. Update import paths.

#### Moving `BottomPanel.tsx` → `shell/BottomPanel.tsx`

The status bar is an app-shell concern. The minimized panel restore buttons should use `Icon` + `PillButton` (or a simpler inline refactor using `Icon`).

#### `OpenDialog.tsx` → `shell/OpenDialog.tsx`

The new gallery/recents dialog (see Track A). It's shell-level because it's a modal overlay triggered by the bottom bar, not a floating panel.

### Refactor of existing components after extraction

**FloatingPanel.tsx**: Replace inline close SVG with `<Icon name="close" size="md" />`.

**FloatingImage.tsx**: Replace inline eye SVGs with `<Icon name="eye-open" />` and `<Icon name="eye-closed" />`.

**FloatingControls.tsx**:
- Replace 3 section headers with `<SectionHeader>`.
- Replace 2 slider rows with `<SliderRow>`.
- Replace preset buttons with `<PillButton>`.
- Replace undo/redo buttons with `<PillButton>` wrapping `<Icon>`.

**FloatingCounter.tsx**:
- Replace timer preset buttons with `<PillButton>`.
- Replace start/stop/reset buttons with `<PillButton size="md">`.

**BottomPanel.tsx**:
- Replace 3 minimized panel restore buttons: use `<Icon>` inside a shared restore-button pattern.
- Replace inline SVGs with `<Icon name="sliders" />`, `<Icon name="image" />`, `<Icon name="clock" />`.

**Canvas.tsx**:
- Replace empty state SVG with `<Icon name="image" size="lg" />`.

---

## Complete File Change Summary

| # | File | Action | Track | Description |
|---|------|--------|-------|-------------|
| 1 | `src/renderer/components/shared/Icon.tsx` | Create | C | SVG icon wrapper + icon registry |
| 2 | `src/renderer/components/shared/PillButton.tsx` | Create | C | Small button with active/inactive/disabled states |
| 3 | `src/renderer/components/shared/SectionHeader.tsx` | Create | C | Uppercase section label |
| 4 | `src/renderer/components/shared/SliderRow.tsx` | Create | C | Label + range input + value display |
| 5 | `src/renderer/components/shell/App.tsx` | Move | C | Move from `components/App.tsx`, update imports |
| 6 | `src/renderer/components/shell/BottomPanel.tsx` | Move+Edit | A,B,C | Move, add OpenDialog trigger, pass defaultPath to save, use Icon |
| 7 | `src/renderer/components/shell/OpenDialog.tsx` | Create | A | Gallery/recents dialog |
| 8 | `src/renderer/components/FloatingPanel.tsx` | Edit | C | Use Icon for close button |
| 9 | `src/renderer/components/FloatingControls.tsx` | Edit | C | Use SectionHeader, SliderRow, PillButton, Icon |
| 10 | `src/renderer/components/FloatingImage.tsx` | Edit | C | Use Icon for eye toggle |
| 11 | `src/renderer/components/FloatingCounter.tsx` | Edit | C | Use PillButton |
| 12 | `src/renderer/components/Canvas.tsx` | Edit | C | Use Icon for empty state |
| 13 | `src/renderer/hooks/useImage.ts` | Edit | A,B | Add `filePath` to state, update `loadImage` signature |
| 14 | `src/renderer/hooks/ImageContext.tsx` | — | — | Auto-typed from useImage, no manual change needed |
| 15 | `src/renderer/global.d.ts` | Edit | A,B | Add new electronAPI methods, update saveImage signature |
| 16 | `src/main/index.ts` | Edit | A,B | Add recents IPC handlers, fix save format, add `open-image-from-path` |
| 17 | `src/preload/index.ts` | Edit | A,B | Expose new IPC methods |
| 18 | `tests/unit/hooks/useImage.test.ts` | Edit | A | Update loadImage calls (add filePath param), test filePath state |
| 19 | Verify | — | — | `yarn typecheck && yarn test && yarn lint && yarn format:check` |

---

## Execution Order

### Phase 1: Foundation (state + IPC)
1. `useImage.ts` — Add `filePath` to state, update `loadImage` signature
2. `tests/unit/hooks/useImage.test.ts` — Update all `loadImage` calls with `filePath`, add filePath tests
3. `global.d.ts` — Add new electronAPI type declarations
4. `src/preload/index.ts` — Expose new IPC methods
5. `src/main/index.ts` — Add recents handlers, fix save-image format handling, add `open-image-from-path`
6. Run `yarn typecheck && yarn test` — Verify foundation

### Phase 2: UI shared components (Track C)
7. `shared/Icon.tsx` — Create icon wrapper + registry
8. `shared/PillButton.tsx` — Create pill button component
9. `shared/SectionHeader.tsx` — Create section header component
10. `shared/SliderRow.tsx` — Create slider row component
11. Run `yarn typecheck` — Verify shared components compile

### Phase 3: Refactor existing components (Track C)
12. `FloatingPanel.tsx` — Replace close SVG with Icon
13. `FloatingControls.tsx` — Replace section headers, sliders, buttons with shared components
14. `FloatingImage.tsx` — Replace eye SVGs with Icon
15. `FloatingCounter.tsx` — Replace buttons with PillButton
16. `Canvas.tsx` — Replace empty state SVG with Icon
17. Run `yarn typecheck && yarn test && yarn lint` — Verify refactor

### Phase 4: Shell restructure + features (Tracks A, B)
18. Move `App.tsx` → `shell/App.tsx`, update entry point import
19. Move `BottomPanel.tsx` → `shell/BottomPanel.tsx`, update App import
20. Create `shell/OpenDialog.tsx` — Gallery/recents modal
21. Update `shell/BottomPanel.tsx` — Wire OpenDialog, pass defaultPath to save, use Icon
22. Run `yarn typecheck && yarn test && yarn lint && yarn format:check` — Final verify

---

## Open Questions / Decisions Needed

1. **Recents storage**: `electron-store` (adds a dependency) vs plain JSON file (manual read/write). Leaning toward plain JSON — it's 20 entries max, simple structure, no need for a library.

2. **BMP save support**: Electron's `nativeImage.toBitmap()` returns raw pixel data without BMP headers. Options: (a) drop BMP from save dialog, keep in open only; (b) add `sharp` dependency for BMP encoding; (c) manually construct BMP headers. Recommendation: option (a) — drop BMP save.

3. **Recents max count**: 20 seems reasonable. Configurable later if needed.

4. **Thumbnail size**: 100px wide for recents storage. Keeps the JSON file small (~5KB per entry for thumbnail data URL).
