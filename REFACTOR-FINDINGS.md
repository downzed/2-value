# Refactor Findings

Deferred cleanups identified during the domain-layer refactor (`core/` classes + `react/` selector
bindings). Verified against the tree at commit `9077283` — note `shell/BottomPanel.tsx` was
subsequently renamed to `shell/TopPanel.tsx` in the working tree.

**Baseline at time of writing:** 281 tests passing, 0 type errors, `yarn build` green.

**How to read the tiers**

| Tier | Meaning |
| --- | --- |
| **0** | Real bugs. Fixed as part of the audit pass. |
| **1** | High payoff-per-effort deduplication. No behaviour change. |
| **2** | Consistency and dead code. Cheap, mechanical. |
| **3** | Structural. Large, review-heavy. |

Dependency between tiers: **do Tier 1 before Tier 2's dead-getter cleanup.** Several
`EditorStore` getters look dead only because components re-derive the same value via inline
selectors. Tier 1 makes them either used or genuinely deletable — deleting them first would
remove a useful API and re-introduce the duplication.

---

## Tier 0 — Fixed in the audit pass

1. **Malformed Tailwind in `EditTagsDialog`** — `gallery/FolderContextMenu.tsx:227-228`
   ```
   'fixed inset-0 z-300]flex items-center justify-center bg-black/40'
   'bg-white rounded-xl shadow-2xl p-5 w-300 space-y-3'
   ```
   Missing `[` in `z-[300]`, and because `z-300]flex` has no space between the tokens, **`flex`
   was swallowed too**. The backdrop had no flex and no z-index; the card had no width. Its three
   sibling dialogs all use `z-[300] flex` correctly.

2. **Stale module import in a test** — `tests/unit/components/OpenItemContextMenu.test.tsx:4`
   imported `OpenItem` from `src/renderer/hooks/useImage`, deleted during the domain refactor.
   Survived only because `import type` is erased at runtime and tests were not typechecked.

3. **Untyped globals in a test helper** — `tests/helpers/mocks.ts` used `OpenItem`,
   `EditorState` and `GalleryState` with no import of them.

4. **Error funnel bypass** — `shell/TopPanel.tsx` (`handleCreateFolderInPicker`) called
   `galleryRepository.createFolder` + `loadGallery` directly, while `react/useSaveFlow.tsx:19-26`
   performs the identical pair through `GalleryStore.#runMutation`. The direct path therefore
   swallowed a failed folder creation during Open.

Also fixed while enabling test typechecking (see below): two test mocks still declared
`ensureUnsortedFolder` after it was removed from `GalleryRepositoryPort`, and one
`saveImageToGallery` call still passed 3 arguments instead of 4. Both passed at runtime because
excess/missing arguments are tolerated, which is exactly the class of drift that went unnoticed.

---

## Tier 1 — High-payoff deduplication

### 1.1 Active-item lookup repeated 19 times (HIGH)

`s.items.find((i) => i.id === s.activeItemId)?.<field> ?? <default>` appears **19 times**:

| Component | Count | Lines |
| --- | --- | --- |
| `Canvas.tsx` | 6 | 50, 51, 52, 53, 54, 59 |
| `shell/TopPanel.tsx` | 5 | 37, 39, 40, 42, 44 |
| `FloatingControls.tsx` | 5 | 19, 20, 21, 22, 23 |
| `FloatingImage.tsx` | 2 | 13, 14 |

The cost is not typing — it is that **defaults now live in two places**. `EditorStore.ts:46` is
the source of truth:

```ts
function createAdjustments() {
	return { blur: 0, threshold: 0, values: 2 as const, showOriginal: false };
}
```

`FloatingControls.tsx:22-23` re-implements `canUndo`/`canRedo` line-for-byte against the selector
rather than reading the store getters. Change the history semantics or add a field to
`AdjustmentSnapshot` and all 19 sites silently diverge.

**Fix.** New `core/selectors.ts` (framework-free, ~15 lines):

```ts
export const selectActiveItem = (s: EditorState): OpenItem | null =>
	s.activeItemId === null ? null : (s.items.find((i) => i.id === s.activeItemId) ?? null);
export const selectBlur = (s: EditorState) => selectActiveItem(s)?.blur ?? 0;
// ... threshold, values, showOriginal, image, isBlank, canUndo, canRedo
```

Then `Canvas.tsx:50` becomes `useEditorSelector(selectBlur)`.

Bonus correctness win: `TopPanel.tsx:44` subscribes to the whole `activeItem` *and* to four
individual fields off it (37, 39, 40, 42) — five subscriptions that always churn together.
Collapsing onto `selectActiveItem` makes it one. Named selectors also avoid re-creating inline
selector closures on every render, which `useSelected` currently tolerates but pays a re-read for.

### 1.2 New-folder form duplicated (HIGH)

`gallery/FolderPickerDialog.tsx:85-145` and `shell/GalleryPanel.tsx:699-752` are near-identical.
The three-line reset appears four times across the two files:

```ts
setNewFolderMode(false);
setNewFolderName('');
setNewFolderError(null);
```

at `FolderPickerDialog.tsx:106-110`, `:123-127` and `GalleryPanel.tsx:717-721`, `:733-737`.

**Fix.** Extract `NewFolderForm({ onCreate })`, ~55 lines. Both sites render it.

### 1.3 Grid-tile markup triplicated (MEDIUM)

`shell/GalleryPanel.tsx` has three tile shapes with identical repeated class strings:

| | image grid | open-items grid | recents grid |
| --- | --- | --- | --- |
| `gridTemplateColumns: repeat(THUMBNAIL_COLS, …)` | 416 | 462 | 605 |
| caption `<span>` class string | 439 | 483 | 626 |
| `<img>` / placeholder | 434 / 436 | 479 / 481 | 621 / 624 |

There is already a **silent divergence**: the placeholder is
`'w-full aspect-square bg-slate-100 animate-pulse'` at 436 and 481 but
`'w-full aspect-square bg-slate-100'` (no pulse) at 624. The button `className` also differs in
ordering, so a style tweak to one tile will not reach the others.

**Fix.** One `GridTile({ src, alt, caption, badge?, selected?, loading?, onClick, onContextMenu })`,
~30 lines, removes ~90 and a whole class of drift.

### 1.4 Six hand-rolled dismissal blocks in three patterns (MEDIUM)

`useMenuPosition` was already extracted and used by all four menus. The **dismissal** half is
still hand-rolled, inconsistently:

| Site | Pattern |
| --- | --- |
| `gallery/FolderContextMenu.tsx:36-37` | outside-click + Escape |
| `gallery/ImageContextMenu.tsx:52-53` | outside-click + Escape |
| `gallery/OpenItemContextMenu.tsx:42-43` | outside-click + Escape (handler renamed `handleMouseDown` for no reason) |
| `shell/FileMenu.tsx:56-57` | outside-click + Escape + refocus + ignore trigger |
| `gallery/FolderPickerDialog.tsx:40` | **Escape only — no outside-click** |

That last row is a live inconsistency: **clicking the folder-picker backdrop does nothing**, unlike
every menu. Four dialogs also duplicate the backdrop shell
(`'fixed inset-0 z-[300] flex items-center justify-center bg-black/40'` wrapping
`'bg-white rounded-xl shadow-2xl p-5 …'`) at `FolderContextMenu.tsx:103-104`, `:170-171`, `:227-228`
and `FolderPickerDialog.tsx:63-64`.

**Fix.** `useDismissable(ref, onClose, { ignoreRef })` next to `useMenuPosition` (~20 lines)
collapses the first four patterns; a `<Modal width>` wrapper (~10 lines) covers the backdrop.
~80 lines removed, and the picker gains backdrop dismissal as a side effect.

---

## Tier 2 — Consistency and dead code

### 2.1 Effective zoom computed in three places (MEDIUM)

`fitMode === 'fit' ? fitScale : zoom` appears at `Canvas.tsx:317`, `Canvas.tsx:330`,
`shell/TopPanel.tsx:52` — while the `EditorStore.effectiveZoom` getter at `core/EditorStore.ts:216`
sits unread. Fixed by 1.1 (`selectEffectiveZoom`), after which the getter becomes redundant.

### 2.2 Gallery search filter duplicated; the tested copy is the dead one (MEDIUM)

`GalleryStore.filteredImages` (`core/GalleryStore.ts:95-99`) holds the logic and has **eight
passing assertions** (`tests/unit/core/GalleryStore.test.ts`). **No component uses it.**
`shell/GalleryPanel.tsx:76-80` ships an untested `useMemo` copy, character-for-character
equivalent:

```ts
const q = gallerySearchQuery.trim().toLowerCase();
if (!q) return images;
return images.filter((img) => img.fileName.toLowerCase().includes(q));
```

Either subscribe to the getter or delete it — right now the tested implementation is dead and the
shipped one is unverified.

### 2.3 Counter time formatted two ways (LOW — deferred by choice)

`FloatingCounter.tsx:27-31` renders `5:00`; `shell/TopPanel.tsx:203-205` renders `5m`. Same
concept, same data, inconsistent output. Reconciling this needs a product decision (see
*Open questions*), so it was deliberately left alone.

### 2.4 Naming inconsistency (LOW)

`Canvas.tsx:59` names the selector `isBlank`; `shell/TopPanel.tsx:37` names the identical
selector `hasBlankCanvas`. A named selector (1.1) removes this by construction.

### 2.5 Folder sort comparator at three sites (LOW)

`[...folders].sort((a, b) => a.sortOrder - b.sortOrder)` at `shell/GalleryPanel.tsx:386` and
`gallery/FolderPickerDialog.tsx:28`; inlined after a `filter` at `gallery/ImageContextMenu.tsx:61`.

### 2.6 Dead constants (LOW — 3 lines)

| Constant | Location | References |
| --- | --- | --- |
| `CANVAS.OPEN_ITEMS.ROW_HEIGHT` | `constants/ui.ts:34` | 1 (the definition) |
| `GALLERY.SUGGESTION_COUNT` | `constants/ui.ts:45` | 1 (the definition) |
| `GALLERY.CACHE_TTL_MS` | `constants/ui.ts:46` | 1 (the definition) |

The latter two are Pexels-suggestion leftovers from the Electron era. Delete all three.

### 2.7 Dead icon paths (LOW)

`shared/Icon.tsx` defines 14 paths; 10 are used. `refresh`, `trash`, `folder` and `layers` have
**zero** `name=` references. Pexels-era leftovers.

### 2.8 Dead store getters (LOW — do after Tier 1)

Verified: **no component reads any of these**; they are read only by `core/` classes, or not at all.

| Getter | `core/EditorStore.ts` | Read by |
| --- | --- | --- |
| `effectiveZoom` | 216 | nothing |
| `canvasMode` | 171 | nothing |
| `currentImage` | 176 | nothing |
| `blankSize` | 220 | nothing |
| `hasCanvas` | 192 | nothing |
| `hasBlankCanvas` | 188 | **nothing at all** |
| `restorableItemIds` | 201 | tests only (removed with `SessionRestorer`) |
| `resetImage` | 341 | tests only |
| `hasImage`, `canUndo`, `canRedo`, `activeItem`, `hasDirtyItems` | — | `core/KeyboardCommands.ts`, `core/UnsavedGuard.ts`, `core/commands.ts` |

Not one React component reads a getter; every one re-derives through a selector. That is the root
cause of 1.1.

### 2.9 Unused `OpenItem` fields (LOW)

`core/types.ts:31-32` `width` / `height` are written (`EditorStore.ts:274-275`, `:303-304`) but
never read — `TopPanel.tsx:65-66` and `Canvas.tsx:346` read `currentImage?.width` instead. The
stored dimensions are dead weight that will go stale silently. `thumbUrl` (`:37`) is likewise
written and never read (`GalleryPanel.tsx` uses its own `openItemThumbs` map), and
`linkGalleryImage`'s `thumbUrl` parameter (`EditorStore.ts:365`) has no caller passing it.

### 2.10 Dead test helpers and duplicate mocks (LOW)

`tests/helpers/mocks.ts` exports three helpers that **no test imports**: `setupIndexedDBMock`
(~83 lines), `setupURLMock`, `setupImageDataMock`.

Three separate `createMockImage` definitions exist with different shapes:
`tests/helpers/mocks.ts:239`, `tests/unit/core/EditorStore.test.ts:5`, and an ad-hoc one in
`tests/unit/core/ImageProcessor.test.ts:11`. One parameterised factory would do.

### 2.11 Stale exported types (LOW)

`src/shared/types.ts:1-8` exports `UNSORTED_FOLDER_NAME` and a
`RecentEntry { path, thumbnail, openedAt }` — both unreferenced, and **`RecentEntry` shadows a
live, incompatible `RecentEntry`** in `utils/storage.ts:466-470`.

---

## Tier 3 — Structural

### 3.1 `GalleryPanel.tsx` is 826 lines with no test file (HIGH)

Largest file in the repo by 2× (next is `EditorStore.ts` at 547). It has five separable concerns:

- thumbnail URL lifecycle with `revokeObjectURL` bookkeeping — `:136-185`
- recents query — `:118-128`
- new-folder form (duplicated, see 1.2) — `:699-752`
- Opened Items virtual folder — `:553-573`
- three grid renderers — `:413-452`, `:455-492`, `:589-631`

`tests/unit/components/` covers Canvas, FileMenu, FloatingCounter, FloatingImage,
OpenItemContextMenu and TopPanel. **There is no `GalleryPanel.test.tsx`** — three duplicated grid
renderers, three context menus and three dialogs are entirely untested.

### 3.2 Cross-domain work leaking into components (MEDIUM)

`GalleryPanel.tsx` holds the editor store (`strokesByItem` at `:58`) purely to render a preview,
duplicating `Commands.renderItemToBlob`'s dispatch (`core/commands.ts:103-118`) with a thumbnail
instead of a blob. This makes the panel touch `strokesByItem`, which `EditorStore.ts:152`
explicitly warns must never enter a snapshot or selector.

**Fix.** Add `Commands.renderItemPreview(item)`; the panel then drops the `strokesByItem`,
`viewport` and editor subscriptions entirely and stops importing `utils/thumbnails`.

Similarly `GalleryPanel.tsx:164` calls `galleryRepository.getThumbnailBlob` directly, holding a
handle to the IndexedDB layer that `GalleryRepositoryPort` (`GalleryStore.ts:20-32`) deliberately
does not expose. That belongs behind a store method.

### 3.3 `utils/` duplicates `core/`, and `storage.ts` boilerplate (MEDIUM)

`utils/storage.ts:46` `generateThumbnailDataUrl` is dead and duplicates the private
`generateThumbnail` (`:33-44`) — same bitmap → OffscreenCanvas → `convertToBlob` sequence, and its
`FileReader` tail already exists as `blobToDataUrl` in `utils/thumbnails.ts:7-14`. Three copies of
blob→data-URL, one unused.

`utils/storage.ts` (503 lines) repeats `new Promise` + `tx.oncomplete`/`onerror` boilerplate **12
times**. `getThumbnailBlob` (`:416-430`) and `getImageBlob` (`:400-414`) are byte-identical apart
from the store name. A `withTx(stores, mode, fn)` helper (~20 lines) collapses all of them.

### 3.4 Layering inversions (LOW)

- `utils/itemRender.ts:3` imports a type from `hooks/useImageProcessingWorker`, which merely
  re-exports it from `core/ImageProcessor.ts:5`. The dependency should point at `core/`.
- `react/useSaveFlow.tsx:2` imports a component (`FolderPickerDialog`). Defensible for a hook
  returning JSX, but it makes the file `.tsx` solely for that reason and gives `react/` a
  `components/` edge.
- `shared/Icon.tsx` / `shared/types.ts` — no `shared/` consumer of substance remains.

### 3.5 Inverted dependencies in tests (MEDIUM)

`tsconfig.json` had `"include": ["src/**/*"]`, so `tests/` was **never typechecked**. This is
recorded because it already caused real breakage (Tier 0 items 2–3) and let four further drifts go
unnoticed. Fixed as part of this pass.

---

## Verified fine — do not re-audit

- **`useMenuPosition` extraction.** Used by all four menus, all applying the same
  `visibility: position ? 'visible' : 'hidden'` first-paint guard. Takes primitives rather than a
  point object, correctly avoiding effect-dependency churn. Covered including all four clamp edges.
- **Selector subscription correctness.** Every `useEditorSelector`/`useGallerySelector` call
  returns a primitive, so the default `Object.is` comparison is sound. No component passes an
  object-returning selector, so `shallowEqual` is correctly unused in production and only
  exercised by tests. Snapshot cache verified, including unsubscribe-on-unmount.
- **The `#patch` referential-stability funnel** in `EditorStore.ts:127-132` and
  `GalleryStore.ts:83-88`. Every no-op mutator guards on equality; the documented invariant holds
  everywhere checked.
- **`updateActive`** (`EditorStore.ts:62-75`) correctly returns the same array when nothing
  changed, and every adjustment mutator routes through it, so per-item history isolation is
  structural rather than per-call-site.
- **`GalleryStore.#runMutation`** (`:123-133`) defines the clear-error → write → reload →
  record-and-rethrow funnel once for all nine mutations. (The bug in Tier 0 item 4 is a component
  *failing to use* it.)
- **`Commands` is genuinely framework-free**, and `useCommands.ts` is a 12-line pass-through. The
  single-shared-export-worker rationale is real.
- **`ImageProcessor` latest-wins queue** — clear-before-register, register-before-post, dispose
  clears pending, synchronous fallback when no worker exists.
- **`decode.ts` bitmap lifecycle** — `close()` in a `finally`, correctly covering the early return.
- **`useDebouncedCallback`** — `fnRef` in `useLayoutEffect` avoids stale closures; timer cleared on
  unmount; `call` depends only on `delay` so it stays stable.
- **Shared UI primitives** — `Icon`, `PillButton`, `SliderRow`, `SectionHeader`, `FloatingWidget`
  all exist and are used consistently.
- **`UnsavedGuard` / `KeyboardCommands`** — idempotent `start()`, bound arrow handlers so
  `removeEventListener` matches, and `isInputFocused()` correctly guards the vim bindings.
- **Store layering direction** — no `core/` file imports from `react/` or `components/`.

---

## Open questions

1. **Counter time format** (2.3) — standardise on `5:00` everywhere, or keep the compact `5m` badge
   in the status bar and make the difference intentional?
2. **`GalleryPanel` split** (3.1) — worth doing as one pass, or incrementally: extract
   `NewFolderForm` and `GridTile` first (Tier 1, already planned), then split the file?