---
name: shell-restructure
description: Move App and BottomPanel into shell/, create OpenDialog for gallery/recents, wire multi-format save, and add new IPC channels. Phase 4 of the gallery-save-refactor plan.
---

## What I do

Restructure the component directory by moving app-shell components into `src/renderer/components/shell/`, create the OpenDialog gallery/recents feature (Track A), and fix multi-format save (Track B). This is Phase 4 of `.opencode/plans/gallery-save-refactor-plan.md`.

## When to use me

Use this skill after the `ui-refactor` skill (Phase 3) is complete and `yarn typecheck && yarn test` pass. Phase 1 (foundation: `filePath` in useImage, IPC type declarations) must also be done.

## Prerequisites

- `useImage.ts` has `filePath` in state and updated `loadImage(image, fileName, filePath)` signature
- `global.d.ts` has the new electronAPI method types
- `src/preload/index.ts` exposes the new IPC methods
- `src/main/index.ts` has the new IPC handlers (recents, open-from-path, fixed save-image)
- All shared components exist in `src/renderer/components/shared/`
- Existing components already use the shared components (Phase 3 done)
- `yarn typecheck && yarn test` pass

## Steps

### 1. Move `App.tsx` → `shell/App.tsx`

Create `src/renderer/components/shell/` directory.

Move `src/renderer/components/App.tsx` to `src/renderer/components/shell/App.tsx`.

Update the import in the renderer entry point. Find the file that imports `App` (likely `src/renderer/main.tsx` or `src/renderer/index.tsx`) and change the import path from `./components/App` to `./components/shell/App`.

### 2. Move `BottomPanel.tsx` → `shell/BottomPanel.tsx`

Move `src/renderer/components/BottomPanel.tsx` to `src/renderer/components/shell/BottomPanel.tsx`.

Update the import in `shell/App.tsx` from `./BottomPanel` to `./BottomPanel` (same directory now — no path change needed if moved together).

Wait — `App.tsx` imports BottomPanel. After both are in `shell/`, the import stays `./BottomPanel`. But `App.tsx` also imports the floating components and Canvas from the parent directory. Update those imports to `../FloatingControls`, `../FloatingImage`, `../FloatingCounter`, `../Canvas`.

### 3. Create `shell/OpenDialog.tsx`

The gallery/recents modal dialog. Reference the plan's Track A section for the full spec.

**Props:**

```ts
interface OpenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImageLoaded: () => void; // Called after successful image load (to close dialog + update status)
}
```

**Behavior:**

1. On mount (when `isOpen` becomes true), call `window.electronAPI.getRecents()` to fetch the recents list.
2. Render a modal overlay (fixed inset-0, z-[60], dark backdrop).
3. Modal content:
   - Title: "Open Image" with close button (use `<Icon name='close' />`)
   - Section: "Recents" (use `<SectionHeader>`) — grid of thumbnail cards
   - Each card: thumbnail image, filename below, hover "×" to remove
   - Divider
   - "Browse Files..." button that triggers `window.electronAPI.openImage()` (existing native dialog flow)
4. Clicking a thumbnail:
   - Call `window.electronAPI.openImageFromPath(path)`
   - If result is null (file missing), remove from recents, show inline error, refresh list
   - If result is valid, convert to image-js Image (same flow as BottomPanel's current handleOpen), call `loadImage(image, fileName, filePath)`, call `onImageLoaded()`
5. "Browse Files..." button:
   - Call `window.electronAPI.openImage()` (existing)
   - On success, call `window.electronAPI.addRecent(result.path)` to add to recents
   - Convert and load via `loadImage(image, fileName, result.path)`, call `onImageLoaded()`
6. Close on: Escape key, backdrop click, close button, or after successful image load.

**Thumbnail grid layout:**
```
grid grid-cols-4 gap-3
```

Each card:
```
relative group rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-slate-400 transition-colors
```

Thumbnail: `<img src={entry.thumbnail} className='w-full aspect-square object-cover' />`
Filename: `<span className='text-[10px] text-slate-500 truncate block px-1 py-0.5'>{entry.fileName}</span>`
Remove button (shown on hover): absolute top-right, small "×" button.

### 4. Update `shell/BottomPanel.tsx`

**Wire OpenDialog:**
- Add local state: `const [openDialogVisible, setOpenDialogVisible] = useState(false);`
- Change `handleOpen` to open the dialog instead of directly calling the native picker: `setOpenDialogVisible(true)`
- Render `<OpenDialog isOpen={openDialogVisible} onClose={() => setOpenDialogVisible(false)} onImageLoaded={() => { setOpenDialogVisible(false); setStatus('loaded'); }} />`
- Update `Ctrl+O` handler to open the dialog instead of calling handleOpen directly.

**Wire multi-format save:**
- Read `filePath` from context.
- Pass it as `defaultPath` to `window.electronAPI.saveImage(dataUrl, filePath)`.
- If `filePath` is empty (no image loaded from disk), fall back to `'untitled.png'`.

**After:**
```ts
const handleSave = useCallback(async () => {
  if (!previewCanvasRef.current) return;
  try {
    setStatus('saving');
    const canvas = previewCanvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const savedPath = await window.electronAPI.saveImage(dataUrl, filePath || 'untitled.png');
    if (savedPath) {
      setStatus('saved');
      setTimeout(() => setStatus('loaded'), 2000);
    } else {
      setStatus('loaded');
    }
  } catch (error) {
    setStatus('error');
    console.error('Failed to save image:', error);
  }
}, [previewCanvasRef, filePath]);
```

**Also update:** The `addRecent` call should happen in the existing native-dialog open flow too. After a successful open via the native picker (now inside OpenDialog), the recents list is updated via `window.electronAPI.addRecent(result.path)`.

### 5. Update imports across the codebase

After moving files, grep for any broken imports:

```bash
yarn typecheck
```

Fix any import path errors. The main places that need updating:
- Renderer entry point (`src/renderer/main.tsx` or similar) — imports App
- `shell/App.tsx` — imports Canvas, FloatingControls, FloatingImage, FloatingCounter from `../`

### 6. Update tests

- `tests/unit/hooks/useImage.test.ts` — If `loadImage` calls were already updated in Phase 1 to include `filePath`, no changes needed here.
- Consider adding a basic test for OpenDialog if time permits, but it's not required for this phase since it depends heavily on `window.electronAPI` mocking.

### 7. Verify

Run the full suite:

```bash
yarn typecheck && yarn test && yarn lint && yarn format:check
```

All existing tests must pass. The file moves should not cause any behavioral changes. The new OpenDialog and save format fix are new features — verify manually with `yarn dev`:

1. Open the app, click "Open" — should show the OpenDialog modal instead of native picker
2. Click "Browse Files..." — should open native picker, image loads, appears in recents next time
3. Close and reopen dialog — recent image should appear as thumbnail
4. Click a recent thumbnail — image should load directly
5. Save an image as `.jpg` — verify the file is actually JPEG (check file header or file size, JPEG is much smaller than PNG)
6. Save defaults to original filename and extension

## Important notes

- The `image-js` `readImg` import is currently in `BottomPanel.tsx`. After the refactor, this import moves to `OpenDialog.tsx` since that's where image loading happens. BottomPanel only handles save.
- The `Ctrl+O` / `Ctrl+S` keyboard shortcuts remain in `shell/BottomPanel.tsx` — they still depend on local state. `Ctrl+O` now opens the dialog modal instead of the native picker.
- The `previewCanvasRef` is created in `shell/App.tsx` and passed to both `Canvas` and `shell/BottomPanel.tsx` — this doesn't change.
- BMP is dropped from the save dialog filters (Electron can't encode BMP headers). Keep BMP in the open dialog filters.
- The save handler always receives a PNG data URL from the canvas. The main process re-encodes to the target format using `nativeImage.toJPEG(90)` or `nativeImage.toPNG()` based on the chosen extension.
