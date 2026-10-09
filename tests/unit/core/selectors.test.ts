import { describe, expect, it } from 'vitest';
import { byNewestFirst, bySortOrder, filterImages } from '../../../src/renderer/core/selectors';
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
