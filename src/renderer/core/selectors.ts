import type { Image } from 'image-js';
import type { GalleryFolder, GalleryImage } from '../../shared/types';
import type { EditorState, OpenItem } from './types';

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
