# Audit

A fresh review of the tree at commit `38d0cfa`, written after the previous findings document was
retired. That document recorded a completed refactor; its line-level references had drifted and it
had become history rather than guidance, so it was deleted rather than patched.

**Baseline:** 401 tests / 31 files passing, 0 type errors, `yarn build` green.

This document lists **only problems that still exist**. Nothing here is a summary of completed work.

---

## Fix first

### 1. Gallery thumbnails break after every mutation (HIGH, pre-existing)

`src/renderer/react/useThumbnailUrls.ts:64-69`

```ts
return () => {
    cancelled = true;
    for (const url of Object.values(newUrls)) {
        URL.revokeObjectURL(url);
    }
};
```

The effect's cleanup revokes **every URL it created**, including those already committed to state.
`GalleryStore.loadGallery` replaces the `images` array with a fresh identity on every load, and
`#runMutation` calls it after each write — so on the next render React tears down the previous
effect and revokes URLs that are still sitting in `urls`. Every thumbnail goes dead after creating
a folder, renaming, moving an image, or deleting anything.

Reproduced, not inferred:

```
AssertionError: expected [ 'blob:0' ] to not include 'blob:0'
```

(`result.current.a` was still `blob:0` while `revokeObjectURL('blob:0')` had already been called.)

**This is not a regression.** The identical logic lived in `GalleryPanel.tsx:180-185` before the hook
was extracted in `a1c1191`; the move was verbatim. It has been latent since the gallery panel shipped
and was never covered by a test — `GalleryPanel.test.tsx` only ever sets `images` once, before
mount, so the cleanup path never runs.

The fix needs a decision: revoking must distinguish URLs that reached state (revoke later, on
removal) from ones that never did (revoke now). A `Map<id, url>` ref, or clearing `newUrls` on
commit, both work. Whichever is chosen, it needs a test that **changes `images` after mount** —
that is the whole reason this survived.

---

## Real defects

### 2. `Modal` is not a dialog (HIGH)

`src/renderer/components/shared/Modal.tsx:16-20` renders two plain `<div>`s. No `role='dialog'`,
no `aria-modal`, no labelling, and no focus management. All four dialogs inherit this —
`FolderPickerDialog`, `DeleteFolderDialog`, `RenameFolderDialog`, `EditTagsDialog`.

- Focus is never moved into the dialog, so Tab leaves it.
- Focus is never restored on close. `useDismissable` only refocuses on the **Escape** path
  (`useDismissable.ts:48`), so a backdrop click strands focus on `<body>`.
- Background content is not inert.

There is no `Modal.test.tsx`, so nothing guards this.

### 3. `FolderPickerDialog` nests a second card inside `Modal` (MEDIUM)

`src/renderer/components/gallery/FolderPickerDialog.tsx:45-47`:

```tsx
<Modal widthClass='w-[360px]'>
    <div ref={rootRef}>
        <div className='bg-white rounded-xl shadow-2xl p-5 w-[360px] space-y-4'>
```

`Modal` already renders `bg-white rounded-xl shadow-2xl p-5 ${widthClass}`. The result is a white
card inside a white card: double shadow, double padding, and `w-[360px]` applied twice so the content
box is narrower than the width every other dialog gets. `widthClass` is also redundant with Modal's
own default.

The other three call sites (`FolderContextMenu.tsx:87,144,190`) pass no inner card — so this is
exactly the drift the `Modal` extraction was meant to remove.

### 4. Two of four context menus lack menu semantics (MEDIUM)

| Menu | `role='menu'` | `role='menuitem'` |
| --- | --- | --- |
| `FileMenu.tsx` | yes | yes |
| `OpenItemContextMenu.tsx` | yes | yes |
| `FolderContextMenu.tsx` | **no** | **no** |
| `ImageContextMenu.tsx` | **no** | **no** |

`MenuItem`'s `role` prop is optional, so two callers silently omit both halves.

### 5. No menu moves focus into itself or handles arrow keys (MEDIUM)

`FileMenu.tsx` and `OpenItemContextMenu.tsx` open a `role='menu'` but never move focus into it and
have no roving tabindex. `role='menu'` without focus management is an incomplete widget. Escape
works; Tab and arrows do not.

### 6. `GridTile`'s selection and dirty dot are colour-only (MEDIUM)

`GridTile.tsx` renders `selected` as a border + ring and `dot` as an amber circle, but passes
**neither** to `Button`'s `aria-pressed`. For a screen-reader user, which item is open and which
have unsaved changes are conveyed by nothing.

This is the same gap that was closed for `FolderPickerDialog`'s cards; `GridTile` was missed.

### 7. `FloatingWidget` drag is mouse-only and mis-roled (MEDIUM)

`FloatingWidget.tsx:59-63` puts `role='toolbar'` on a div with `onMouseDown` drag handling. The role
promises arrow-key navigation that does not exist, and there is no keyboard way to reposition any
floating panel. `FloatingCounter`, `FloatingControls` and `FloatingImage` all render through this, and
it has no test file.

### 8. `Canvas.tsx` holds a third copy of the stroke renderer (MEDIUM)

`Canvas.tsx:24-48` (`applyBrushStyle` + `paintStroke`) duplicates `thumbnails.ts:59-88`
(`renderStrokes`) line for line — same `lineCap`/`lineJoin`, same `stroke.length < 4 → arc` dot
fallback with a near-identical comment, same stride-2 loop. `thumbnails.ts` documents itself as
"shared by the hover preview and the export path so both look identical"; the live editing surface
is a third copy that is not shared.

### 9. `selectHasImage` re-implemented inline (MEDIUM)

`selectors.ts:40` defines it; `TopPanel.tsx:51` re-derives the same thing from state. That undercuts
the stated purpose of `selectors.ts`. `FloatingControls.tsx:28` uses the selector correctly.

### 10. `Stroke` declared three times (LOW)

`core/types.ts:15` (canonical), `utils/thumbnails.ts:5`, `Canvas.tsx:22` — and
`utils/itemRender.ts:43` inlines a bare `number[][]` instead of importing any of them.

### 11. `Icon` exposes raw icon keys as accessible names (LOW)

`Icon.tsx:45-46` uses `<title>{name}</title>`, so an icon announces as "eye-open" or "arrow-left".
Inside `Button` the explicit `aria-label` wins, so most usages are fine — but `Canvas.tsx:368` renders
one standalone and decorative, where it will be announced before the adjacent "No image loaded".

---

## Dead code

### 12. Two unreachable repository methods (MEDIUM)

`utils/storage.ts:192` `reorderFolders` (11 lines) and `:336` `clearAll` (10 lines). Zero callers
**anywhere**, and neither is on `GalleryRepositoryPort`, so no consumer can reach them.

### 13. `EditorStore.fileName` has no production reader (MEDIUM)

`core/EditorStore.ts:170-172`. Six test assertions read it; nothing in `src/` does. Components read
`selectActiveFileName` or `item.fileName` directly. This corrects an earlier claim that it was kept
because `KeyboardCommands`/`UnsavedGuard`/`commands` used it — they do not.

### 14. Test-only exports (LOW)

`removeRecentEntry` and `clearAllRecents` (`utils/storage.ts:390,394`) are called only from
`storage.recents.test.ts`. No UI path removes a recent or clears the list.

### 15. Dead re-export barrel (LOW)

`hooks/useImageProcessingWorker.ts:5` re-exports `ProcessParams`/`ProcessResult`. After 3.4
repointed `itemRender.ts` at `core/ImageProcessor`, this barrel has no consumers.

### 16. `IconToggle.className` is never passed (LOW)

Declared, destructured, interpolated — no call site supplies it.

### 17. Unused devDependency (LOW)

`@testing-library/jest-dom` is in `package.json` but never imported; `tests/setup.ts` does not load
it. Related: `vitest.config.ts` configures `coverage.provider: 'v8'` but `@vitest/coverage-v8` is not
installed, so `vitest run --coverage` fails on a missing dependency.

---

## Tests that do not test

These pass, but would keep passing if the code were deleted. They are worse than no test because
they read as coverage.

### 18. `saveOpenItem` "activates a background item" is vacuous (HIGH)

`tests/unit/core/commands.test.ts:179-198`. It opens an image, calls `newBlankCanvas()` so the blank
becomes active, then passes **that same blank** to `saveOpenItem`. The `activateItem` branch is never
reached, and `renderItemToBlob` returns `null` in jsdom so `saveActiveItemToGallery` is never called.
**The test passes if `saveOpenItem`'s body is replaced with `return;`.**

### 19. `useThumbnailUrls` has no test — which is why finding 1 survived (HIGH)

The hook is only exercised via `GalleryPanel.test.tsx`, which sets `images` once before mount. No
test changes `images` afterwards, so the cleanup path — the entire bug — never runs.

### 20. KeyboardCommands vim tests (MEDIUM)

- `:128-137` "ignores vim keys when no image is open" asserts `items` has length 0, which is true
  whether or not the handler ran. Delete the `hasImage` guard and it still passes.
- `:86-95` "clamps vim steps to the allowed range" starts blur at 0, so `h` clamps to 0 — satisfied by
  the starting value. The upper clamp is never exercised, and the `setZoom(4)` on the line above is
  unrelated leftover.

### 21. Tautology (MEDIUM)

`tests/unit/utils/storage.recents.test.ts:45-47` — `expect(RECENTS_MAX).toBe(5)`. Asserts a constant
equals its own literal.

### 22. Vacuous assertions (MEDIUM)

- `commands.test.ts:277` — `expect(() => commands.dispose()).not.toThrow()`. `dispose` cannot throw;
  the test does not check the worker was terminated.
- `DialogButton.test.tsx:27` — `expect(() => render(...)).not.toThrow()`. The optionality of
  `onClick` is already enforced by the type system.

### 23. Weak where precise was intended (MEDIUM)

`IconButton.test.tsx:30-42` fires a click with `clientX/clientY` and asserts
`expect(onClick.mock.calls[0][0]).toBeTruthy()`. The event is always truthy. The actual claim — that
coordinates reach the handler (`GalleryPanel.tsx:136` reads them) — is unchecked.

### 24. Dead setup (LOW)

`decode.test.ts:12-15` calls `vi.resetModules()` in `beforeEach`, but the file uses static imports and
never calls `importActual`/`doMock`. It has no effect.

---

## Coverage gaps

**21 source modules have no test file.** The ones that matter, by risk:

| Module | Lines | Why |
| --- | --- | --- |
| `react/useThumbnailUrls.ts` | 73 | Object-URL lifecycle; hides finding 1 |
| `utils/thumbnails.ts` | 117 | Three renderers, zero tests |
| `utils/itemRender.ts` | 52 | Happy paths never run (jsdom has no `OffscreenCanvas`) |
| `utils/imageConversion.ts` | 27 | Never executed; both consumers mock it out |
| `workers/imageProcessor.worker.ts` | 177 | The core pixel algorithm, 0% |
| `gallery/FolderContextMenu.tsx` | 211 | Ships three dialogs; none tested |
| `gallery/ImageContextMenu.tsx` | 126 | The only two-level submenu |
| `gallery/NewFolderForm.tsx` | 101 | Owns error + in-flight guard |
| `components/shared/Modal.tsx` | 22 | Hides finding 2 |
| `components/shared/FloatingWidget.tsx` | 80 | Hides finding 7 |
| `components/FloatingControls.tsx` | 176 | Debounced sliders, presets, reset |
| `core/store.ts` | 51 | `createAppStore` never called directly |

Two modules are materially under-tested:

- **`utils/storage.ts` (397 lines).** `storage.recents.test.ts` covers the ~45 lines of
  localStorage helpers. `GalleryRepository` (lines 47–346) has **zero** coverage — including
  `withTx`'s `db.close()` contract and the whole `deleteFolder` fallback branch that decides whether
  images are dropped or reassigned. Note that finding 2.10 in the retired document deleted
  `setupIndexedDBMock` as dead, removing the only mechanism that could have covered this.
- **`core/decode.ts`.** No happy-path test and no `TOO_MANY_PIXELS` test.

---

## Verified clean — do not re-audit

- **Typecheck, lint, format, and the 401-test suite are green.**
- **`<button>` consolidation held.** `rg '<button' src` returns exactly one element
  (`Button.tsx:67`) plus its doc comment, and `FileMenu.tsx:56` — a menu trigger that legitimately
  needs `ref` + `aria-haspopup` + `aria-expanded`. No component duplicates wrapper logic.
- **`constants/ui.ts`** — all 24 constants have real consumers.
- **`core/selectors.ts`** — all 17 exports have consumers.
- **No runtime import cycle.** `core/` → `utils/` and `utils/` → `core/` both exist and are acyclic
  today, but `utils/itemRender.ts:3` is a *type-only* edge into `core/` that would become a runtime
  cycle the moment it stopped importing a type. Worth an ESLint rule or a comment.
- **`react/` does not import `components/`** — `useSaveFlow.ts` returns props, `SaveFolderPrompt.tsx`
  renders them.
- **`UnsavedGuard`, `KeyboardCommands`, `ImageProcessor`, `GalleryStore`, `useStore`, `Button`,
  `FileMenu`, `useDismissable`, `useDebouncedCallback`, `GridTile`** — genuinely substantive tests.
- **Every `Button` without a `label`** has text content or an `<img alt>`. No nameless button.