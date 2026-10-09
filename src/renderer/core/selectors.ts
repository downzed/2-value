import type { Image } from 'image-js';
import type { GalleryFolder, GalleryImage } from '../../shared/types';
import type { GalleryState } from './GalleryStore';
import type { EditorState, FitMode, OpenItem, PanelId, Viewport } from './types';

/**
 * Named selectors for `EditorState`.
 *
 * These exist so the active-item lookup and its defaults are defined once.
 * Inline selectors repeated the same `find(...)?.field ?? default` expression in
 * nineteen places across four components, which meant the defaults had a second
 * home next to `createAdjustments()` in `EditorStore`.
 *
 * Every one of these returns a primitive or a stable reference, so the default
 * `Object.is` comparison in `useEditorSelector` stays sound and `shallowEqual`
 * remains unnecessary.
 */

/** The item currently projected onto the editor, or null when nothing is open. */
export const selectActiveItem = (s: EditorState): OpenItem | null =>
	s.activeItemId === null ? null : (s.items.find((i) => i.id === s.activeItemId) ?? null);

export const selectActiveImage = (s: EditorState): Image | null => selectActiveItem(s)?.image ?? null;

export const selectActiveFileName = (s: EditorState): string => selectActiveItem(s)?.fileName ?? '';

export const selectBlur = (s: EditorState): number => selectActiveItem(s)?.blur ?? 0;

export const selectThreshold = (s: EditorState): number => selectActiveItem(s)?.threshold ?? 0;

export const selectValues = (s: EditorState): 2 | 3 => selectActiveItem(s)?.values ?? 2;

export const selectShowOriginal = (s: EditorState): boolean => selectActiveItem(s)?.showOriginal ?? false;

/** True when the active item is a blank canvas rather than a photo. */
export const selectIsBlank = (s: EditorState): boolean => selectActiveItem(s)?.kind === 'blank';

/** True when something is open at all — an image or a blank canvas. */
export const selectHasCanvas = (s: EditorState): boolean => selectActiveItem(s) !== null;

export const selectHasImage = (s: EditorState): boolean => selectActiveItem(s)?.image != null;

/** True when the active item already has a gallery entry to overwrite on save. */
export const selectHasGalleryEntry = (s: EditorState): boolean =>
	(selectActiveItem(s)?.galleryImageId ?? null) !== null;

export const selectCanUndo = (s: EditorState): boolean => (selectActiveItem(s)?.history.length ?? 0) > 0;

export const selectCanRedo = (s: EditorState): boolean => (selectActiveItem(s)?.future.length ?? 0) > 0;

/** Zoom resolves through fit mode; `zoom` only applies when the user has zoomed. */
export const selectEffectiveZoom = (s: EditorState): number => (s.fitMode === 'fit' ? s.fitScale : s.zoom);

// ---------------------------------------------------------------------------
// Direct state reads
//
// Trivial accessors, but named so components never write an inline
// `(s) => s.field` closure. Two reasons: the definition lives in one place, and
// the subscription no longer depends on a fresh function identity per render.
//
// These return objects, not primitives — `items`, `panels`, `folders` and
// `images` are references. That is safe only because the stores preserve
// identity: `updateActive` returns the same array when nothing changed, and
// `#patch` is a no-op on equality. `panels` is rebuilt solely by `togglePanel` /
// `setPanel`, which are genuine changes. See AUDIT.md.
// ---------------------------------------------------------------------------

export const selectItems = (s: EditorState): OpenItem[] => s.items;
export const selectActiveItemId = (s: EditorState): string | null => s.activeItemId;
export const selectViewport = (s: EditorState): Viewport => s.viewport;
export const selectZoom = (s: EditorState): number => s.zoom;
export const selectFitMode = (s: EditorState): FitMode => s.fitMode;
export const selectPanels = (s: EditorState): Record<PanelId, boolean> => s.panels;
export const selectCounter = (s: EditorState): number => s.counter;
export const selectCounterRunning = (s: EditorState): boolean => s.counterRunning;
export const selectCounterDuration = (s: EditorState): number | null => s.counterDuration;

/**
 * Per-panel open flags, one selector each.
 *
 * These are separate named functions rather than a `selectPanelOpen(panel)`
 * factory on purpose: `useSelected` memoises its snapshot getter on the
 * selector's identity, so a curried factory would build a new function on every
 * render and re-read the store each time. Three of the four panels are read by
 * exactly one component, so the explicitness costs nothing.
 */
export const selectControlsOpen = (s: EditorState): boolean => s.panels.controls;
export const selectOriginalOpen = (s: EditorState): boolean => s.panels.original;
export const selectTimerOpen = (s: EditorState): boolean => s.panels.timer;
export const selectGalleryOpen = (s: EditorState): boolean => s.panels.gallery;

// ---------------------------------------------------------------------------
// Gallery selectors
// ---------------------------------------------------------------------------

export const selectFolders = (s: GalleryState): GalleryFolder[] => s.folders;
export const selectImages = (s: GalleryState): GalleryImage[] => s.images;
export const selectSelectedFolderId = (s: GalleryState): string | null => s.selectedFolderId;
export const selectGallerySearchQuery = (s: GalleryState): string => s.gallerySearchQuery;
export const selectGalleryLoading = (s: GalleryState): boolean => s.loading;
export const selectGalleryError = (s: GalleryState): string | null => s.error;

// ---------------------------------------------------------------------------
// Gallery helpers
//
// Pure functions rather than state selectors: they take their inputs directly so
// the store getter and the component can share one implementation. `core` has no
// dependency on `utils`, so `storage.ts` is free to import from here too.
// ---------------------------------------------------------------------------

/** Orders folders by their stored position. Pass a copy; `sort` is in place. */
export const bySortOrder = (a: GalleryFolder, b: GalleryFolder): number => a.sortOrder - b.sortOrder;

/** Most recently added first, which is the order every image grid renders. */
export const byNewestFirst = (a: GalleryImage, b: GalleryImage): number => b.addedAt - a.addedAt;

/**
 * Filters images by a search query. Matches file names only, across every
 * folder rather than the selected one. A blank query returns the input array
 * unchanged so callers can rely on referential equality for memoisation.
 */
export function filterImages(images: GalleryImage[], query: string): GalleryImage[] {
	const q = query.trim().toLowerCase();
	if (!q) return images;
	return images.filter((img) => img.fileName.toLowerCase().includes(q));
}
