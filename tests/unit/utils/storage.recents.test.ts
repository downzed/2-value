import { beforeEach, describe, expect, it } from 'vitest';
import {
	addRecentEntry,
	clearAllRecents,
	getRecents,
	RECENTS_MAX,
	removeRecentEntry,
} from '../../../src/renderer/utils/storage';

describe('recents', () => {
	beforeEach(() => {
		clearAllRecents();
	});

	it('starts empty', () => {
		expect(getRecents()).toEqual([]);
	});

	it('records an entry', () => {
		addRecentEntry('g1', 'study.png');
		expect(getRecents()).toEqual([{ galleryImageId: 'g1', fileName: 'study.png', openedAt: expect.any(Number) }]);
	});

	it('puts the newest entry first', () => {
		addRecentEntry('g1', 'a.png');
		addRecentEntry('g2', 'b.png');
		expect(getRecents().map((e) => e.galleryImageId)).toEqual(['g2', 'g1']);
	});

	it('moves a re-opened entry back to the front instead of duplicating it', () => {
		addRecentEntry('g1', 'a.png');
		addRecentEntry('g2', 'b.png');
		addRecentEntry('g1', 'a.png');

		const entries = getRecents();
		expect(entries).toHaveLength(2);
		expect(entries[0].galleryImageId).toBe('g1');
	});

	it('keeps at most RECENTS_MAX entries', () => {
		for (let i = 0; i < RECENTS_MAX + 4; i++) addRecentEntry(`g${i}`, `${i}.png`);
		expect(getRecents()).toHaveLength(RECENTS_MAX);
	});

	it('caps the suggestion list at five', () => {
		expect(RECENTS_MAX).toBe(5);
	});

	it('removes a single entry', () => {
		addRecentEntry('g1', 'a.png');
		addRecentEntry('g2', 'b.png');
		removeRecentEntry('g1');
		expect(getRecents().map((e) => e.galleryImageId)).toEqual(['g2']);
	});

	it('ignores malformed storage contents', () => {
		localStorage.setItem('image-editor-recents', 'not json');
		expect(getRecents()).toEqual([]);
	});

	it('drops entries that are not shaped like a recent', () => {
		localStorage.setItem('image-editor-recents', JSON.stringify([{ nope: true }, 5, 'x']));
		expect(getRecents()).toEqual([]);
	});

	it('survives a non-array stored value', () => {
		localStorage.setItem('image-editor-recents', JSON.stringify({ a: 1 }));
		expect(getRecents()).toEqual([]);
	});
});
