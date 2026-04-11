import electron from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GalleryData, GalleryFolder, GalleryImage } from '../shared/types';

const { app, nativeImage, net } = electron;

const UNSORTED_FOLDER_NAME = 'Unsorted';
const THUMBNAIL_WIDTH = 200;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

let galleryCache: GalleryData | null = null;
let galleryRootDir: string | null = null;

// Serialise all gallery mutations to prevent lost-update races (read-modify-write)
let mutationQueue: Promise<void> = Promise.resolve();

function withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
	const result = mutationQueue.then(fn);
	// Advance the queue regardless of whether this mutation succeeds or fails
	mutationQueue = result.then(
		() => {},
		() => {},
	);
	return result;
}

function galleryDir(): string {
	if (!galleryRootDir) galleryRootDir = path.join(app.getPath('userData'), 'gallery');
	return galleryRootDir;
}

function imagesDir(): string {
	return path.join(galleryDir(), 'images');
}

function thumbnailsDir(): string {
	return path.join(galleryDir(), 'thumbnails');
}

function galleryJsonPath(): string {
	return path.join(galleryDir(), 'gallery.json');
}

function sanitizeFolderName(name: string): string {
	return name
		.replace(/[/\\:*?"<>|]/g, '')
		.trim()
		.slice(0, 100);
}

function isReservedFolderName(name: string): boolean {
	return name.toLowerCase() === UNSORTED_FOLDER_NAME.toLowerCase();
}

export async function loadGallery(): Promise<GalleryData> {
	if (galleryCache) return galleryCache;
	const raw = await fs.promises.readFile(galleryJsonPath(), 'utf-8');
	galleryCache = JSON.parse(raw) as GalleryData;
	return galleryCache;
}

async function saveGallery(data: GalleryData): Promise<void> {
	const json = JSON.stringify(data, null, 2);
	const tmpPath = `${galleryJsonPath()}.tmp`;
	await fs.promises.writeFile(tmpPath, json, 'utf-8');
	await fs.promises.rename(tmpPath, galleryJsonPath());
	galleryCache = data;
}

export async function initGallery(): Promise<void> {
	await fs.promises.mkdir(galleryDir(), { recursive: true });
	await fs.promises.mkdir(imagesDir(), { recursive: true });
	await fs.promises.mkdir(thumbnailsDir(), { recursive: true });

	let data: GalleryData;
	let isNew = false;
	try {
		const raw = await fs.promises.readFile(galleryJsonPath(), 'utf-8');
		data = JSON.parse(raw) as GalleryData;
	} catch {
		isNew = true;
		const unsorted: GalleryFolder = {
			id: randomUUID(),
			name: UNSORTED_FOLDER_NAME,
			tags: [],
			createdAt: Date.now(),
			sortOrder: 0,
		};
		data = { version: 1, folders: [unsorted], images: [] };
		await saveGallery(data);
	}

	// Ensure Unsorted folder always exists
	if (!data.folders.some((f) => f.name === UNSORTED_FOLDER_NAME)) {
		const unsorted: GalleryFolder = {
			id: randomUUID(),
			name: UNSORTED_FOLDER_NAME,
			tags: [],
			createdAt: Date.now(),
			sortOrder: -1,
		};
		data = { ...data, folders: [unsorted, ...data.folders] };
		await saveGallery(data);
	}

	galleryCache = data;

	if (isNew) {
		await migrateRecents();
	}
}

function getUnsortedFolderId(data: GalleryData): string {
	const folder = data.folders.find((f) => f.name === UNSORTED_FOLDER_NAME);
	if (!folder) throw new Error('Unsorted folder not found');
	return folder.id;
}

async function generateThumbnail(imagePath: string, thumbnailPath: string): Promise<void> {
	const img = nativeImage.createFromPath(imagePath);
	if (img.isEmpty()) throw new Error('Cannot read image for thumbnail generation');
	const thumb = img.resize({ width: THUMBNAIL_WIDTH });
	await fs.promises.writeFile(thumbnailPath, thumb.toPNG());
}

async function generateThumbnailFromBuffer(buffer: Buffer, thumbnailPath: string): Promise<void> {
	const img = nativeImage.createFromBuffer(buffer);
	if (img.isEmpty()) throw new Error('Cannot read image buffer for thumbnail generation');
	const thumb = img.resize({ width: THUMBNAIL_WIDTH });
	await fs.promises.writeFile(thumbnailPath, thumb.toPNG());
}

function getImageDimensions(imgPath: string): { width: number; height: number } {
	const img = nativeImage.createFromPath(imgPath);
	return img.getSize();
}

function getImageDimensionsFromBuffer(buffer: Buffer): { width: number; height: number } {
	const img = nativeImage.createFromBuffer(buffer);
	return img.getSize();
}

export function getImagePath(imageId: string): string {
	const data = galleryCache;
	if (!data) throw new Error('Gallery not initialized');
	const image = data.images.find((i) => i.id === imageId);
	if (!image) throw new Error(`Image ${imageId} not found`);
	return path.join(imagesDir(), image.storedFileName);
}

export function importImage(sourcePath: string, folderId: string): Promise<GalleryImage> {
	return withMutationLock(async () => {
		const data = await loadGallery();

		if (!data.folders.some((f) => f.id === folderId)) {
			throw new Error(`Folder ${folderId} not found`);
		}

		// Duplicate check by originalPath
		const existing = data.images.find((i) => i.originalPath === sourcePath);
		if (existing) {
			const folder = data.folders.find((f) => f.id === existing.folderId);
			throw new Error(`Image already in folder: ${folder?.name ?? 'Unknown'}`);
		}

		const id = randomUUID();
		const ext = path.extname(sourcePath).toLowerCase() || '.png';
		const storedFileName = `${id}${ext}`;
		const thumbnailFileName = `${id}_thumb.png`;
		const storedPath = path.join(imagesDir(), storedFileName);
		const thumbnailPath = path.join(thumbnailsDir(), thumbnailFileName);

		await fs.promises.copyFile(sourcePath, storedPath);
		await generateThumbnail(storedPath, thumbnailPath);

		const { width, height } = getImageDimensions(storedPath);
		const stat = await fs.promises.stat(storedPath);

		const image: GalleryImage = {
			id,
			folderId,
			fileName: path.basename(sourcePath),
			originalPath: sourcePath,
			storedFileName,
			thumbnailFileName,
			width,
			height,
			fileSize: stat.size,
			addedAt: Date.now(),
			source: 'local',
		};

		const updated: GalleryData = { ...data, images: [...data.images, image] };
		await saveGallery(updated);
		return image;
	});
}

export function moveImage(imageId: string, targetFolderId: string): Promise<void> {
	return withMutationLock(async () => {
		const data = await loadGallery();

		if (!data.folders.some((f) => f.id === targetFolderId)) {
			throw new Error(`Folder ${targetFolderId} not found`);
		}

		const updated: GalleryData = {
			...data,
			images: data.images.map((i) => (i.id === imageId ? { ...i, folderId: targetFolderId } : i)),
		};
		await saveGallery(updated);
	});
}

export function copyImage(imageId: string, targetFolderId: string): Promise<GalleryImage> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const source = data.images.find((i) => i.id === imageId);
		if (!source) throw new Error(`Image ${imageId} not found`);

		if (!data.folders.some((f) => f.id === targetFolderId)) {
			throw new Error(`Folder ${targetFolderId} not found`);
		}

		const newId = randomUUID();
		const ext = path.extname(source.storedFileName);
		const newStoredFileName = `${newId}${ext}`;
		const newThumbnailFileName = `${newId}_thumb.png`;

		await fs.promises.copyFile(
			path.join(imagesDir(), source.storedFileName),
			path.join(imagesDir(), newStoredFileName),
		);
		await fs.promises.copyFile(
			path.join(thumbnailsDir(), source.thumbnailFileName),
			path.join(thumbnailsDir(), newThumbnailFileName),
		);

		const newImage: GalleryImage = {
			...source,
			id: newId,
			folderId: targetFolderId,
			storedFileName: newStoredFileName,
			thumbnailFileName: newThumbnailFileName,
			addedAt: Date.now(),
		};

		const updated: GalleryData = { ...data, images: [...data.images, newImage] };
		await saveGallery(updated);
		return newImage;
	});
}

export function deleteImage(imageId: string): Promise<void> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const image = data.images.find((i) => i.id === imageId);
		if (!image) return;

		try {
			await fs.promises.unlink(path.join(imagesDir(), image.storedFileName));
		} catch {
			// ignore if file is missing
		}
		try {
			await fs.promises.unlink(path.join(thumbnailsDir(), image.thumbnailFileName));
		} catch {
			// ignore if file is missing
		}

		const updated: GalleryData = { ...data, images: data.images.filter((i) => i.id !== imageId) };
		await saveGallery(updated);
	});
}

export function createFolder(name: string, tags: string[] = []): Promise<GalleryFolder> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const sanitized = sanitizeFolderName(name);
		if (!sanitized) throw new Error('Invalid folder name');
		if (isReservedFolderName(sanitized)) throw new Error(`"${UNSORTED_FOLDER_NAME}" is a reserved folder name`);

		const folder: GalleryFolder = {
			id: randomUUID(),
			name: sanitized,
			tags,
			createdAt: Date.now(),
			sortOrder: data.folders.length,
		};

		const updated: GalleryData = { ...data, folders: [...data.folders, folder] };
		await saveGallery(updated);
		return folder;
	});
}

export function renameFolder(folderId: string, newName: string): Promise<void> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const folder = data.folders.find((f) => f.id === folderId);
		if (!folder) throw new Error(`Folder ${folderId} not found`);
		if (folder.name === UNSORTED_FOLDER_NAME) throw new Error('Cannot rename Unsorted folder');

		const sanitized = sanitizeFolderName(newName);
		if (!sanitized) throw new Error('Invalid folder name');
		if (isReservedFolderName(sanitized)) throw new Error(`"${UNSORTED_FOLDER_NAME}" is a reserved folder name`);

		const updated: GalleryData = {
			...data,
			folders: data.folders.map((f) => (f.id === folderId ? { ...f, name: sanitized } : f)),
		};
		await saveGallery(updated);
	});
}

export function deleteFolder(folderId: string, deleteImages: boolean): Promise<void> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const folder = data.folders.find((f) => f.id === folderId);
		if (!folder) throw new Error(`Folder ${folderId} not found`);
		if (folder.name === UNSORTED_FOLDER_NAME) throw new Error('Cannot delete Unsorted folder');

		const folderImages = data.images.filter((i) => i.folderId === folderId);

		if (deleteImages) {
			for (const img of folderImages) {
				try {
					await fs.promises.unlink(path.join(imagesDir(), img.storedFileName));
				} catch {
					// ignore
				}
				try {
					await fs.promises.unlink(path.join(thumbnailsDir(), img.thumbnailFileName));
				} catch {
					// ignore
				}
			}
			const updated: GalleryData = {
				...data,
				folders: data.folders.filter((f) => f.id !== folderId),
				images: data.images.filter((i) => i.folderId !== folderId),
			};
			await saveGallery(updated);
		} else {
			const unsortedId = getUnsortedFolderId(data);
			const updated: GalleryData = {
				...data,
				folders: data.folders.filter((f) => f.id !== folderId),
				images: data.images.map((i) => (i.folderId === folderId ? { ...i, folderId: unsortedId } : i)),
			};
			await saveGallery(updated);
		}
	});
}

export function updateFolderTags(folderId: string, tags: string[]): Promise<void> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const updated: GalleryData = {
			...data,
			folders: data.folders.map((f) => (f.id === folderId ? { ...f, tags } : f)),
		};
		await saveGallery(updated);
	});
}

export function reorderFolders(orderedIds: string[]): Promise<void> {
	return withMutationLock(async () => {
		const data = await loadGallery();
		const updated: GalleryData = {
			...data,
			folders: data.folders.map((f) => {
				const idx = orderedIds.indexOf(f.id);
				return idx >= 0 ? { ...f, sortOrder: idx } : f;
			}),
		};
		await saveGallery(updated);
	});
}

export function downloadExternalImage(
	url: string,
	folderId: string,
	metadata: { sourceId: string; author: string; authorUrl: string; description: string },
): Promise<GalleryImage> {
	return withMutationLock(async () => {
		// Validate URL scheme (https only — prevents SSRF to local network/file system)
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch {
			throw new Error('Invalid URL');
		}
		if (parsedUrl.protocol !== 'https:') {
			throw new Error('Only HTTPS URLs are allowed for external image downloads');
		}

		const data = await loadGallery();

		if (!data.folders.some((f) => f.id === folderId)) {
			throw new Error(`Folder ${folderId} not found`);
		}

		// Duplicate check by sourceId
		const existing = data.images.find((i) => i.sourceMetadata?.sourceId === metadata.sourceId);
		if (existing) {
			const folder = data.folders.find((f) => f.id === existing.folderId);
			throw new Error(`Image already in folder: ${folder?.name ?? 'Unknown'}`);
		}

		const response = await net.fetch(url);
		if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);

		// Enforce size limit before buffering the full response
		const contentLength = response.headers.get('content-length');
		if (contentLength && Number(contentLength) > MAX_DOWNLOAD_BYTES) {
			throw new Error('Image exceeds maximum download size');
		}

		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
			throw new Error('Image exceeds maximum download size');
		}

		// Determine extension from URL
		let ext = '.jpg';
		const urlPath = parsedUrl.pathname;
		const urlExt = path.extname(urlPath).toLowerCase();
		if (['.png', '.jpg', '.jpeg', '.webp'].includes(urlExt)) ext = urlExt;

		const id = randomUUID();
		const storedFileName = `${id}${ext}`;
		const thumbnailFileName = `${id}_thumb.png`;
		const storedPath = path.join(imagesDir(), storedFileName);
		const thumbnailPath = path.join(thumbnailsDir(), thumbnailFileName);

		await fs.promises.writeFile(storedPath, buffer);
		await generateThumbnailFromBuffer(buffer, thumbnailPath);

		const { width, height } = getImageDimensionsFromBuffer(buffer);

		const fileName = metadata.description
			? `${sanitizeFolderName(metadata.description).slice(0, 50)}${ext}`
			: path.basename(urlPath) || `image${ext}`;

		const image: GalleryImage = {
			id,
			folderId,
			fileName,
			originalPath: url,
			storedFileName,
			thumbnailFileName,
			width,
			height,
			fileSize: buffer.byteLength,
			addedAt: Date.now(),
			source: 'sourcesplash',
			sourceMetadata: {
				sourceId: metadata.sourceId,
				author: metadata.author,
				authorUrl: metadata.authorUrl,
				description: metadata.description,
			},
		};

		const updated: GalleryData = { ...data, images: [...data.images, image] };
		await saveGallery(updated);
		return image;
	});
}

async function migrateRecents(): Promise<void> {
	const recentsPath = path.join(app.getPath('userData'), 'recents.json');
	try {
		const raw = await fs.promises.readFile(recentsPath, 'utf-8');
		const recents = JSON.parse(raw) as Array<{ path: string; fileName: string }>;
		if (!Array.isArray(recents) || recents.length === 0) return;

		const data = await loadGallery();
		const unsortedId = getUnsortedFolderId(data);

		for (const entry of recents) {
			if (!entry.path) continue;
			try {
				await fs.promises.access(entry.path);
				await importImage(entry.path, unsortedId);
			} catch {
				// Skip entries that no longer exist or fail to import (e.g. duplicates)
			}
		}
	} catch {
		// No recents.json or invalid format — nothing to migrate
	}
}

export function getThumbnailsDir(): string {
	return thumbnailsDir();
}
