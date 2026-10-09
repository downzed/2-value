# Refactor Findings

Deferred cleanups identified during the domain-layer refactor (`core/` classes + `react/` selector
bindings). Verified against the tree at commit `9077283` — note `shell/BottomPanel.tsx` was
subsequently renamed to `shell/TopPanel.tsx` in the working tree.

**Baseline at time of writing:** 281 tests passing, 0 type errors, `yarn build` green.
**Status:** All four tiers complete, plus the shared-button pass. Nothing open.
**Current:** 387 tests across 30 files, 0 type errors.

**How to read the tiers**

| Tier | Meaning |
| --- | --- |
| **0** | Real bugs. **Done.** |
| **1** | High payoff-per-effort deduplication. No behaviour change. **Done.** |
| **2** | Consistency and dead code. Cheap, mechanical. **Done** (except 2.3, deferred). |
| **3** | Structural. Large, review-heavy. **Done.** |

Additions made during the Tier 2 pass, alongside the findings above:

- **B1 — Shared `<button>` components** (user request). Two new components in
  `components/shared/` absorb the hand-rolled button markup that was duplicated across
  `shell/TopPanel.tsx` and `FloatingControls.tsx`. See *Shared buttons* below.
- **B2 — Shared gallery helpers.** `bySortOrder`, `byNewestFirst` and `filterImages` moved into
  `core/selectors.ts`, which unifies the duplication found in 2.2 and 2.5.

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

### 1.1 Active-item lookup repeated 19 times (HIGH) — **DONE**

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

**Result:** `src/renderer/core/selectors.ts` now defines 15 named selectors; the 19 inline
lookups are gone. `selectEffectiveZoom` also retired the third `fitMode === 'fit' ? …` copy
(see 2.1, which is therefore also resolved).

### 1.2 New-folder form duplicated (HIGH) — **DONE**

`gallery/FolderPickerDialog.tsx:85-145` and `shell/GalleryPanel.tsx:699-752` are near-identical.
The three-line reset appears four times across the two files:

```ts
setNewFolderMode(false);
setNewFolderName('');
setNewFolderError(null);
```

at `FolderPickerDialog.tsx:106-110`, `:123-127` and `GalleryPanel.tsx:717-721`, `:733-737`.

**Fix.** Extract `NewFolderForm({ onCreate })`, ~55 lines. Both sites render it.

**Result:** `components/gallery/NewFolderForm.tsx` owns the name/error/in-flight state. The
extraction also fixed a latent bug: the gallery's copy had no `disabled={creating}` guard, so
double-submitting could create two folders; the picker's did.

### 1.3 Grid-tile markup triplicated (MEDIUM) — **DONE**

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

**Result:** `components/gallery/GridTile.tsx` exports `TileGrid` (the repeated column layout) and
`GridTile`. All three grids now render through it, and the recents placeholder pulses like the
other two.

### 1.4 Six hand-rolled dismissal blocks in three patterns (MEDIUM) — **DONE**

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

**Result:** `react/useDismissable.ts` + `components/shared/Modal.tsx`. Zero hand-rolled
`mousedown` listeners remain in `components/`, and the folder picker now dismisses on a backdrop
click. `ImageContextMenu` keeps its submenu behaviour by passing
`() => (subMenu ? setSubMenu(null) : onClose())`.

---

## Tier 2 — Consistency and dead code

### 2.1 Effective zoom computed in three places (MEDIUM) — **DONE via 1.1**

`fitMode === 'fit' ? fitScale : zoom` appears at `Canvas.tsx:317`, `Canvas.tsx:330`,
`shell/TopPanel.tsx:52` — while the `EditorStore.effectiveZoom` getter at `core/EditorStore.ts:216`
sits unread. Fixed by 1.1 (`selectEffectiveZoom`), after which the getter becomes redundant.
`EditorStore.effectiveZoom` is now genuinely dead and can be removed (see 2.8).

### 2.2 Gallery search filter duplicated; the tested copy is the dead one (MEDIUM) — **DONE**

`GalleryStore.filteredImages` (`core/GalleryStore.ts:95-99`) held the logic and had **eight
passing assertions** (`tests/unit/core/GalleryStore.test.ts`). **No component used it.**
`shell/GalleryPanel.tsx:76-80` shipped an untested `useMemo` copy, character-for-character
equivalent:

```ts
const q = gallerySearchQuery.trim().toLowerCase();
if (!q) return images;
return images.filter((img) => img.fileName.toLowerCase().includes(q));
```

Resolved by extracting a pure `filterImages(images, query)` into `core/selectors.ts`, called by
both the store getter and the component. The getter is still unread by components (they subscribe
to `images` + `gallerySearchQuery` and filter in a `useMemo`), but both paths now run the same
tested code, so the duplication is gone rather than merely relocated. `filterImages` returns its
input array unchanged for a blank query, which keeps the component's memoisation cheap.

### 2.3 Counter time formatted two ways (LOW — **RESOLVED: keep both, on purpose**)

`FloatingCounter.tsx` renders `5:00` in the timer widget; `shell/TopPanel.tsx` renders `5m` on the
status bar's timer badge. Same concept, same data, different output.

**Decision: leave them different.** The badge sits inside a 24px icon button where seconds would be
unreadable, so it is deliberately lossy — a glanceable nudge, not a readout. Both format functions
now carry a comment pointing at the other and explaining why they differ, so the next reader
records the choice instead of re-opening it.

This closes the last open item in the document.

### 2.4 Naming inconsistency (LOW) — **DONE via 1.1**

`Canvas.tsx:59` named the selector `isBlank`; `shell/TopPanel.tsx:37` named the identical
selector `hasBlankCanvas`. Resolved by 1.1: both now use `selectIsBlank`.

### 2.5 Folder sort comparator at three sites (LOW) — **DONE**

`[...folders].sort((a, b) => a.sortOrder - b.sortOrder)` appeared at `shell/GalleryPanel.tsx:386`
and `gallery/FolderPickerDialog.tsx:28`, inlined after a `filter` at `gallery/ImageContextMenu.tsx:61`,
and once more in `utils/storage.ts:173` (the delete-folder fallback, which survived the site survey).
Extracted `bySortOrder` and `byNewestFirst` into `core/selectors.ts`; all four sites now import them.
`core` has no dependency on `utils`, so `storage.ts` importing from it stays acyclic.

### 2.6 Dead constants (LOW — 3 lines) — **DONE**

| Constant | Location | References |
| --- | --- | --- |
| `CANVAS.OPEN_ITEMS.ROW_HEIGHT` | `constants/ui.ts:34` | 1 (the definition) |
| `GALLERY.SUGGESTION_COUNT` | `constants/ui.ts:45` | 1 (the definition) |
| `GALLERY.CACHE_TTL_MS` | `constants/ui.ts:46` | 1 (the definition) |

The latter two are Pexels-suggestion leftovers from the Electron era. All three deleted.

### 2.7 Dead icon paths (LOW) — **DONE**

`shared/Icon.tsx` defined 14 paths; 10 were used. `refresh`, `trash`, `folder` and `layers` had
**zero** `name=` references. Pexels-era leftovers; all four deleted.

### 2.8 Dead store getters (LOW — now actionable, Tier 1 is done) — **DONE**

Verified: **no component reads any of these**; they are read only by `core/` classes, or not at all.
Tier 1 has now landed, so these were genuinely dead rather than merely bypassed.

| Getter | Read by | Outcome |
| --- | --- | --- |
| `effectiveZoom` | nothing | deleted |
| `canvasMode` | nothing | deleted |
| `currentImage` | nothing | deleted |
| `blankSize` | nothing | deleted |
| `hasCanvas` | nothing | deleted |
| `hasBlankCanvas` | **nothing at all** | deleted |
| `restorableItemIds` | tests only (removed with `SessionRestorer`) | deleted |
| `hasImage`, `canUndo`, `canRedo`, `activeItem`, `hasDirtyItems`, `fileName` | `core/KeyboardCommands.ts`, `core/UnsavedGuard.ts`, `core/commands.ts` | **kept** |

`EditorStore.effectiveZoom` was the only one with a `select*` twin (`selectEffectiveZoom`); the rest
were either unread or superseded by a named selector that reads the item directly.

**`resetImage` was deliberately kept.** It also has no production caller, but three tests exercise
it as the "close everything" path, and deleting it would drop that coverage rather than remove dead
weight. Left as a judgement call rather than a silent deletion.

Tests that only asserted on a deleted getter were rewritten against the remaining public surface
(`store.activeItem`, `store.hasImage`, `activeItem(store).kind`) so they still cover real behaviour.
The two `blankSize` tests were dropped outright: `shell/TopPanel.tsx` already computes the blank
dimensions from `viewport` inline, so there was nothing left for them to cover.

### 2.9 Unused `OpenItem` fields (LOW) — **DONE**

`core/types.ts:31-32` `width` / `height` were written (`EditorStore.ts:274-275`, `:303-304`) but
never read — `TopPanel.tsx:65-66` and `Canvas.tsx:346` read `currentImage?.width` instead. The
stored dimensions were dead weight that would go stale silently. `thumbUrl` (`:37`) was likewise
written and never read (`GalleryPanel.tsx` uses its own `openItemThumbs` map), and
`linkGalleryImage`'s `thumbUrl` parameter (`EditorStore.ts:365`) had no caller passing it.

All three fields and the extra parameter removed, along with `OpenImageMeta.thumbUrl`.

### 2.10 Dead test helpers and duplicate mocks (LOW) — **DONE**

`tests/helpers/mocks.ts` exported three helpers that **no test imports**: `setupIndexedDBMock`
(~83 lines, pulling in two `MockIDB*` classes), `setupURLMock`, `setupImageDataMock`. All deleted,
along with the classes only they referenced.

Two `createMockImage` definitions existed with different shapes:
`tests/helpers/mocks.ts:239` and `tests/unit/core/EditorStore.test.ts:5` (the third, in
`ImageProcessor.test.ts`, had already been removed in an earlier phase). `EditorStore.test.ts` now
imports the shared factory. The local copy's `clone: () => ({})` was never called anywhere, so
nothing was lost. `OpenItemContextMenu.test.tsx` also had a hand-rolled `makeItem` duplicating
`createOpenItem`; it now uses the shared helper.

### 2.11 Stale exported types (LOW) — **DONE**

`src/shared/types.ts:1-8` exported `UNSORTED_FOLDER_NAME` and a
`RecentEntry { path, thumbnail, openedAt }` — both unreferenced, and **`RecentEntry` shadowed a
live, incompatible `RecentEntry`** in `utils/storage.ts:466-470`. Both deleted.

---

## Shared buttons (B1) — **DONE**

`<button>` markup was hand-rolled at **43 call sites** across `components/`, differing only in class
strings and icon. Ten components in `components/shared/` and `components/gallery/` now own it.

`SegmentedControl` was **not** the right vehicle for most of these. It models a row of mutually
exclusive toggles; context-menu items, dialog footers and ghost icon buttons have nothing to do
with each other, and routing them through it would have produced a component whose name lies about
its behaviour and whose `variant` prop does all the work. Three components shaped for the actual
duplication were added instead.

| Component | Replaced | Notes |
| --- | --- | --- |
| `SegmentedControl<T>` | 2 sites | `tone: 'light' \| 'dark'` drives four class differences |
| `IconToggle` | 4 panel toggles | optional `badge`; `relative` only when one is present |
| `MenuItem` | 13 context-menu rows | `tone: 'default' \| 'danger' \| 'muted'`; optional `role='menuitem'` |
| `DialogButton` | 9 dialog footers | `variant: 'primary' \| 'ghost' \| 'danger' \| 'submit'` |
| `IconButton` | 9 chrome icons | `surface: 'light' \| 'dark'`; `tone='pressed'` for the eye toggle |
| `PillButton` (extended) | timer Start/Stop | added `tone: 'success' \| 'danger'` for solid accents |
| `FolderRow` | 2 folder cards | title + count, `emphasis='strong'` for Opened Items |
| `NewFolderCard` | 2 sites | byte-identical dashed "+ New Folder" tile |

**43 → 8 real call sites**; the other 6 are the components themselves.

### Behaviour changes worth knowing

- **Destructive rows were two shades.** The context menus mixed `text-red-500` and `text-red-600`
  for the same intent. `MenuItem` uses red-600 throughout.
- **`PillButton` and `IconButton` now report `aria-pressed`.** Previously neither set it, so the
  preset pills and the eye toggle had no accessible pressed state. A solid-accent button does not
  set it — it is not a toggle.
- **`IconButton` forwards the click event.** The folder kebab menu anchors its context menu to the
  pointer, so `onClick` takes the event rather than being zero-arg.

### Deliberately left as raw `<button>`

Four call sites are one-offs where a shared component would have fought the markup rather than
helped it:

- `NewFolderForm`'s submit/cancel pair — `flex-1 text-[10px] rounded` at a different size from
  `DialogButton`'s `px-3 py-1.5 text-xs rounded-lg`. Overriding both would mean shipping conflicting
  Tailwind utilities in `className`.
- `FolderPickerDialog`'s selectable folder card — bordered cards with a selected/unselected pair,
  a different shape from `FolderRow`'s unbordered rows.
- `FileMenu`'s trigger — needs a `ref`, `aria-haspopup` and `aria-expanded`; it is a menu button,
  not a chrome icon.
- `FloatingControls`' "Reset" — an unpadded text-only link-style button.

Tests: `SegmentedControl` (8), `IconToggle` (7), `MenuItem` (6), `DialogButton` (7), `IconButton`
(9), `PillButton` (7), `FolderRow` + `NewFolderCard` (7).

---

## Tier 3 — Structural — **DONE**

### 3.1 `GalleryPanel.tsx` is 826 lines with no test file (HIGH) — **DONE**

Largest file in the repo by 2× (next is `EditorStore.ts` at 547). It had five separable concerns:

| Concern | Outcome |
| --- | --- |
| thumbnail URL lifecycle with `revokeObjectURL` bookkeeping | → `react/useThumbnailUrls.ts` |
| recents query | → `gallery/RecentSuggestions.tsx` |
| new-folder form (duplicated, see 1.2) | → `gallery/NewFolderForm.tsx` (Tier 1) |
| three grid renderers | → `gallery/GridTile.tsx` (Tier 1) |
| Opened Items virtual folder | left in place; covered by tests instead |

**826 → 609 lines**, and `tests/unit/components/GalleryPanel.test.tsx` now exists with **26 tests**
covering visibility, the folder list (ordering, per-folder counts, pluralisation), folder detail,
search (cross-folder filtering, result counts, override of an open folder), Opened Items, and
thumbnail loading. That was the HIGH-priority half of this finding — three grid renderers, three
context menus and three dialogs had been entirely untested.

Two behaviours worth recording because the tests pin them down:

- `GridTile` renders a placeholder `<div>`, not an `<img>`, when a thumbnail is missing, so
  assertions go through the tile's `aria-label` rather than `alt` text.
- Open-item previews load **lazily on the row's context menu**, not on render. Rendering a tile with
  no `src` is expected, not a bug.

### 3.2 Cross-domain work leaking into components (MEDIUM) — **DONE**

`GalleryPanel.tsx` held the editor store (`strokesByItem`) purely to render a preview, duplicating
`Commands.renderItemToBlob`'s dispatch with a thumbnail instead of a blob. This made the panel touch
`strokesByItem`, which `EditorStore.ts` explicitly warns must never enter a snapshot or selector.

**Done.** `Commands.renderItemPreview(item)` owns the same kind/image dispatch and returns a data
URL. The panel drops the `strokesByItem` and `viewport` subscriptions entirely and no longer imports
`utils/thumbnails`. The invariant is now enforced by the module graph rather than by convention.

The second half: the panel called `galleryRepository.getThumbnailBlob` directly, holding a handle to
the IndexedDB layer that `GalleryRepositoryPort` deliberately does not expose. `getThumbnailBlob`
is now on the port, with a `GalleryStore` passthrough mirroring `getImageBlob`. The panel's last
`galleryRepository` import is gone.

### 3.3 `utils/` duplicates `core/`, and `storage.ts` boilerplate (MEDIUM) — **DONE**

`utils/storage.ts` `generateThumbnailDataUrl` was dead and duplicated the private
`generateThumbnail` — same bitmap → OffscreenCanvas → `convertToBlob` sequence, and its
`FileReader` tail already existed as `blobToDataUrl` in `utils/thumbnails.ts`. Three copies of
blob→data-URL, one unused. Deleted; two remain and both are live.

`storage.ts` repeated `new Promise` + `tx.oncomplete`/`onerror` + `db.close()` boilerplate
**12 times**. A `withTx(stores, mode, fn)` helper now owns it, and `idbGetBlob` collapses
`getThumbnailBlob` / `getImageBlob`, which were byte-identical apart from the store name.

**15 → 2 `new Promise`, 503 → 397 lines.** The two that remain are `openDB` and the mutation lock,
which are not transaction boilerplate. `withTx` closes the connection on both paths, so no caller
can leak one — and it documents the constraint that `fn` must not await, since IndexedDB commits as
soon as the microtask queue drains.

### 3.4 Layering inversions (LOW) — **DONE**

- `utils/itemRender.ts` imported `ProcessParams` from `hooks/useImageProcessingWorker`, which merely
  re-exports it from `core/ImageProcessor.ts`. Repointed at `core/`.
- `react/useSaveFlow.tsx` imported a component (`FolderPickerDialog`), making the file `.tsx` solely
  for that reason and giving `react/` a `components/` edge. **Fixed:** the hook now returns a `prompt`
  props object and lives in `useSaveFlow.ts`; `gallery/SaveFolderPrompt.tsx` renders it. `react/`
  no longer imports `components/`.
- `shared/types.ts` — **reconsidered, not acted on.** The original claim that "no `shared/` consumer
  of substance remains" no longer holds: `shared/types.ts` is now imported by six files across
  `core/`, `components/` and `utils/`, since Tier 2's `selectors.ts` took its gallery types from
  there. `shared/Icon.tsx` is renderer-specific and could move, but that is churn without a
  benefit.

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

None. The three that were open during the audit have all been settled:

1. **Counter time format** (2.3) — **settled: keep both formats.** The status-bar badge is
   deliberately lossy; see 2.3.
2. **`GalleryPanel` split** (3.1) — **settled.** 826 → 609 lines with 26 tests. What remains is
   ordinary presentation; splitting further would move code without reducing coupling.
3. **`shared/Icon.tsx`** (3.4) — **settled: leave it.** Moving it under `components/shared/` is
   churn without benefit; its only real consumer already lives there.