import { describe, expect, it } from 'vitest';
import {
	byNewestFirst,
	bySortOrder,
	filterImages,
	selectActiveItemId,
	selectControlsOpen,
	selectCounter,
	selectCounterDuration,
	selectCounterRunning,
	selectFitMode,
	selectFolders,
	selectGalleryError,
	selectGalleryLoading,
	selectGalleryOpen,
	selectGallerySearchQuery,
	selectImages,
	selectItems,
	selectOriginalOpen,
	selectPanels,
	selectSelectedFolderId,
	selectTimerOpen,
	selectViewport,
	selectZoom,
} from '../../../src/renderer/core/selectors';
import type { GalleryState } from '../../../src/renderer/core/GalleryStore';
import type { EditorState } from '../../../src/renderer/core/types';
import type { GalleryFolder, GalleryImage } from '../../../src/shared/types';

const folder = (id: string, sortOrder: number): GalleryFolder => ({
	id,
	name: id,
	tags: [],
	createdAt: 0,
	sortOrder,
});

const image = (id: string, fileName: string, addedAt = 0): GalleryImage => ({
	id,
	fileName,
	folderId: 'f1',
	width: 1,
	height: 1,
	fileSize: 0,
	addedAt,
	source: 'local',
});

describe('bySortOrder', () => {
	it('orders folders by their stored position', () => {
		const sorted = [folder('c', 2), folder('a', 0), folder('b', 1)].sort(bySortOrder);

		expect(sorted.map((f) => f.id)).toEqual(['a', 'b', 'c']);
	});

	it('treats equal positions as equal', () => {
		expect(bySortOrder(folder('a', 1), folder('b', 1))).toBe(0);
	});
});

describe('byNewestFirst', () => {
	it('orders images by addedAt descending', () => {
		const sorted = [image('old', 'a.png', 1), image('new', 'b.png', 5), image('mid', 'c.png', 3)].sort(byNewestFirst);

		expect(sorted.map((i) => i.id)).toEqual(['new', 'mid', 'old']);
	});
});

describe('filterImages', () => {
	const images = [image('1', 'Beach.jpg'), image('2', 'portrait.png'), image('3', 'sunset_beach.jpg')];

	it('returns the input unchanged for a blank query', () => {
		// Referential equality keeps the caller's memoisation cheap.
		expect(filterImages(images, '')).toBe(images);
		expect(filterImages(images, '   ')).toBe(images);
	});

	it('matches file names case-insensitively', () => {
		expect(filterImages(images, 'BEACH').map((i) => i.id)).toEqual(['1', '3']);
	});

	it('matches on a substring, not a prefix', () => {
		expect(filterImages(images, 'each').map((i) => i.id)).toEqual(['1', '3']);
	});

	it('trims the query before matching', () => {
		expect(filterImages(images, '  portrait  ').map((i) => i.id)).toEqual(['2']);
	});

	it('returns nothing when no file name matches', () => {
		expect(filterImages(images, 'missing')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Direct state reads
//
// These are the selectors that replaced inline `(s) => s.field` closures in
// components. The behavioural contract worth pinning down is not the field read
// itself but the *identity* guarantee: several return references, and the
// subscription hook only avoids a re-render if the store hands back the same
// object. That holds because the stores preserve identity, which is asserted
// here as a property of the selectors rather than of the stores.
// ---------------------------------------------------------------------------

const editorState = () =>
	({
		items: [],
		activeItemId: null,
		viewport: { width: 0, height: 0 },
		zoom: 1,
		fitMode: 'fit',
		fitScale: 1,
		counter: 0,
		counterRunning: false,
		counterDuration: null,
		panels: { controls: false, original: false, timer: false, gallery: false },
	}) as EditorState;

describe('direct state reads', () => {
	it('reads each field from the state it names', () => {
		const s = editorState();

		expect(selectItems(s)).toBe(s.items);
		expect(selectActiveItemId(s)).toBe(s.activeItemId);
		expect(selectViewport(s)).toBe(s.viewport);
		expect(selectZoom(s)).toBe(1);
		expect(selectFitMode(s)).toBe('fit');
		expect(selectPanels(s)).toBe(s.panels);
		expect(selectCounter(s)).toBe(0);
		expect(selectCounterRunning(s)).toBe(false);
		expect(selectCounterDuration(s)).toBe(null);
	});

	it('returns the same reference for an unchanged state', () => {
		const s = editorState();

		// These return objects. If any of them rebuilt on every call, every
		// subscriber would re-render on every store notification.
		expect(selectItems(s)).toBe(selectItems(s));
		expect(selectPanels(s)).toBe(selectPanels(s));
		expect(selectViewport(s)).toBe(selectViewport(s));
	});

	it('reflects a changed field', () => {
		const before = editorState();
		const after: EditorState = { ...before, zoom: 2, counter: 30, activeItemId: 'item-1' };

		expect(selectZoom(after)).toBe(2);
		expect(selectCounter(after)).toBe(30);
		expect(selectActiveItemId(after)).toBe('item-1');
	});

	it('keeps a null counter duration distinct from zero', () => {
		const s = editorState();

		// Null means "no timer set"; 0 means "a zero-second timer". Collapsing
		// them would disable Start in the counter widget.
		expect(selectCounterDuration(s)).toBe(null);
		expect(selectCounterDuration({ ...s, counterDuration: 0 })).toBe(0);
	});

	it('reports each panel flag independently', () => {
		const s: EditorState = {
			...editorState(),
			panels: { controls: true, original: false, timer: true, gallery: false },
		};

		expect(selectControlsOpen(s)).toBe(true);
		expect(selectOriginalOpen(s)).toBe(false);
		expect(selectTimerOpen(s)).toBe(true);
		expect(selectGalleryOpen(s)).toBe(false);
	});
});

describe('gallery selectors', () => {
	const galleryState = () =>
		({
			folders: [folder('f1', 0)],
			images: [image('i1', 'a.png')],
			selectedFolderId: 'f1',
			gallerySearchQuery: '',
			loading: false,
			error: null,
		}) as GalleryState;

	it('reads each field from the state it names', () => {
		const s = galleryState();

		expect(selectFolders(s)).toBe(s.folders);
		expect(selectImages(s)).toBe(s.images);
		expect(selectSelectedFolderId(s)).toBe('f1');
		expect(selectGallerySearchQuery(s)).toBe('');
		expect(selectGalleryLoading(s)).toBe(false);
		expect(selectGalleryError(s)).toBe(null);
	});

	it('returns the same reference for an unchanged state', () => {
		const s = galleryState();

		expect(selectFolders(s)).toBe(selectFolders(s));
		expect(selectImages(s)).toBe(selectImages(s));
	});

	it('distinguishes "no error" from an empty one', () => {
		const s = galleryState();

		expect(selectGalleryError(s)).toBe(null);
		expect(selectGalleryError({ ...s, error: '' })).toBe('');
	});
});
