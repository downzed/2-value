import type { GalleryData, GalleryFolder, GalleryImage } from '../../shared/types';

const DB_NAME = 'image-editor-gallery';
const DB_VERSION = 1;
const UNSORTED_FOLDER_NAME = 'Unsorted';

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('folders')) {
				db.createObjectStore('folders', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('images')) {
				db.createObjectStore('images', { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains('imageBlobs')) {
				db.createObjectStore('imageBlobs', { keyPath: 'imageId' });
			}
			if (!db.objectStoreNames.contains('thumbnailBlobs')) {
				db.createObjectStore('thumbnailBlobs', { keyPath: 'imageId' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function getDB(): Promise<IDBDatabase> {
	return openDB();
}

async function generateThumbnail(blob: Blob, maxWidth = 200): Promise<Blob> {
	const bitmap = await createImageBitmap(blob);
	const width = maxWidth;
	const height = Math.round(bitmap.height * (maxWidth / bitmap.width));
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not get 2d context from OffscreenCanvas');
	ctx.drawImage(bitmap, 0, 0, width, height);
	const thumbnailBlob = await canvas.convertToBlob({ type: 'image/png' });
	bitmap.close();
	return thumbnailBlob;
}

export async function generateThumbnailDataUrl(blob: Blob, maxSize = 100): Promise<string> {
	const bitmap = await createImageBitmap(blob);
	const scale = maxSize / Math.max(bitmap.width, bitmap.height);
	const width = Math.round(bitmap.width * scale);
	const height = Math.round(bitmap.height * scale);
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not get 2d context from OffscreenCanvas');
	ctx.drawImage(bitmap, 0, 0, width, height);
	const thumbnailBlob = await canvas.convertToBlob({ type: 'image/png' });
	bitmap.close();
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(reader.result as string);
		reader.readAsDataURL(thumbnailBlob);
	});
}

export class GalleryStore {
	private mutationQueue: Promise<void> = Promise.resolve();

	private withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
		const result = this.mutationQueue.then(fn);
		this.mutationQueue = result.then(
			() => {},
			() => {},
		);
		return result;
	}

	private async idbGetAll<T>(storeName: string): Promise<T[]> {
		const db = await getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(storeName, 'readonly');
			const store = tx.objectStore(storeName);
			const request = store.getAll();
			tx.oncomplete = () => {
				resolve(request.result as T[]);
				db.close();
			};
			tx.onerror = () => {
				reject(tx.error);
				db.close();
			};
		});
	}

	private async idbPut(storeName: string, value: unknown): Promise<void> {
		const db = await getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(storeName, 'readwrite');
			const store = tx.objectStore(storeName);
			store.put(value);
			tx.oncomplete = () => {
				resolve();
				db.close();
			};
			tx.onerror = () => {
				reject(tx.error);
				db.close();
			};
		});
	}

	async init(): Promise<void> {
		await this.withMutationLock(async () => {
			const db = await getDB();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction('folders', 'readwrite');
				const store = tx.objectStore('folders');
				const request = store.getAll();
				tx.oncomplete = () => {
					const folders = request.result as GalleryFolder[];
					const hasUnsorted = folders.some((f) => f.name === UNSORTED_FOLDER_NAME);
					if (!hasUnsorted) {
						const unsorted: GalleryFolder = {
							id: crypto.randomUUID(),
							name: UNSORTED_FOLDER_NAME,
							tags: [],
							createdAt: Date.now(),
							sortOrder: 0,
						};
						store.put(unsorted);
					}
					resolve();
					db.close();
				};
				tx.onerror = () => {
					reject(tx.error);
					db.close();
				};
			});
		});
	}

	async getData(): Promise<GalleryData> {
		const [folders, images] = await Promise.all([
			this.idbGetAll<GalleryFolder>('folders'),
			this.idbGetAll<GalleryImage>('images'),
		]);
		return { version: 1, folders, images };
	}

	async createFolder(name: string, tags?: string[]): Promise<GalleryFolder> {
		return this.withMutationLock(async () => {
			const data = await this.getData();
			const folder: GalleryFolder = {
				id: crypto.randomUUID(),
				name,
				tags: tags ?? [],
				createdAt: Date.now(),
				sortOrder: data.folders.length,
			};
			await this.idbPut('folders', folder);
			return folder;
		});
	}

	async renameFolder(folderId: string, newName: string): Promise<void> {
		return this.withMutationLock(async () => {
			const folders = await this.idbGetAll<GalleryFolder>('folders');
			const folder = folders.find((f) => f.id === folderId);
			if (!folder) throw new Error(`Folder ${folderId} not found`);
			if (folder.name === UNSORTED_FOLDER_NAME) throw new Error('Cannot rename Unsorted folder');
			await this.idbPut('folders', { ...folder, name: newName });
		});
	}

	async deleteFolder(folderId: string, deleteImages: boolean): Promise<void> {
		return this.withMutationLock(async () => {
			const data = await this.getData();
			const folder = data.folders.find((f) => f.id === folderId);
			if (!folder) throw new Error(`Folder ${folderId} not found`);
			if (folder.name === UNSORTED_FOLDER_NAME) throw new Error('Cannot delete Unsorted folder');

			const folderImages = data.images.filter((i) => i.folderId === folderId);

			if (deleteImages) {
				const db = await getDB();
				await new Promise<void>((resolve, reject) => {
					const tx = db.transaction(['images', 'imageBlobs', 'thumbnailBlobs', 'folders'], 'readwrite');
					for (const img of folderImages) {
						tx.objectStore('images').delete(img.id);
						tx.objectStore('imageBlobs').delete(img.id);
						tx.objectStore('thumbnailBlobs').delete(img.id);
					}
					tx.objectStore('folders').delete(folderId);
					tx.oncomplete = () => {
						resolve();
						db.close();
					};
					tx.onerror = () => {
						reject(tx.error);
						db.close();
					};
				});
			} else {
				const unsortedFolder = data.folders.find((f) => f.name === UNSORTED_FOLDER_NAME);
				if (!unsortedFolder) throw new Error('Unsorted folder not found');
				const unsortedId = unsortedFolder.id;
				const db = await getDB();
				await new Promise<void>((resolve, reject) => {
					const tx = db.transaction(['images', 'folders'], 'readwrite');
					for (const img of folderImages) {
						tx.objectStore('images').put({ ...img, folderId: unsortedId });
					}
					tx.objectStore('folders').delete(folderId);
					tx.oncomplete = () => {
						resolve();
						db.close();
					};
					tx.onerror = () => {
						reject(tx.error);
						db.close();
					};
				});
			}
		});
	}

	async updateFolderTags(folderId: string, tags: string[]): Promise<void> {
		return this.withMutationLock(async () => {
			const folders = await this.idbGetAll<GalleryFolder>('folders');
			const folder = folders.find((f) => f.id === folderId);
			if (!folder) throw new Error(`Folder ${folderId} not found`);
			await this.idbPut('folders', { ...folder, tags });
		});
	}

	async reorderFolders(orderedIds: string[]): Promise<void> {
		return this.withMutationLock(async () => {
			const folders = await this.idbGetAll<GalleryFolder>('folders');
			for (const f of folders) {
				const idx = orderedIds.indexOf(f.id);
				if (idx >= 0) {
					await this.idbPut('folders', { ...f, sortOrder: idx });
				}
			}
		});
	}

	async importImage(file: File, folderId: string): Promise<GalleryImage> {
		return this.withMutationLock(async () => {
			const data = await this.getData();

			if (!data.folders.some((f) => f.id === folderId)) {
				throw new Error(`Folder ${folderId} not found`);
			}

			const id = crypto.randomUUID();
			const thumbnailBlob = await generateThumbnail(file);
			const bitmap = await createImageBitmap(file);
			const { width, height } = bitmap;
			bitmap.close();

			const image: GalleryImage = {
				id,
				folderId,
				fileName: file.name,
				width,
				height,
				fileSize: file.size,
				addedAt: Date.now(),
				source: 'local',
			};

			const db = await getDB();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(['images', 'imageBlobs', 'thumbnailBlobs'], 'readwrite');
				tx.objectStore('images').put(image);
				tx.objectStore('imageBlobs').put({ imageId: id, blob: file });
				tx.objectStore('thumbnailBlobs').put({ imageId: id, blob: thumbnailBlob });
				tx.oncomplete = () => {
					resolve();
					db.close();
				};
				tx.onerror = () => {
					reject(tx.error);
					db.close();
				};
			});

			return image;
		});
	}

	async moveImage(imageId: string, targetFolderId: string): Promise<void> {
		return this.withMutationLock(async () => {
			const images = await this.idbGetAll<GalleryImage>('images');
			const folders = await this.idbGetAll<GalleryFolder>('folders');
			if (!folders.some((f) => f.id === targetFolderId)) {
				throw new Error(`Folder ${targetFolderId} not found`);
			}
			const img = images.find((i) => i.id === imageId);
			if (!img) throw new Error(`Image ${imageId} not found`);
			await this.idbPut('images', { ...img, folderId: targetFolderId });
		});
	}

	async copyImage(imageId: string, targetFolderId: string): Promise<GalleryImage> {
		return this.withMutationLock(async () => {
			const images = await this.idbGetAll<GalleryImage>('images');
			const source = images.find((i) => i.id === imageId);
			if (!source) throw new Error(`Image ${imageId} not found`);

			const folders = await this.idbGetAll<GalleryFolder>('folders');
			if (!folders.some((f) => f.id === targetFolderId)) {
				throw new Error(`Folder ${targetFolderId} not found`);
			}

			const db = await getDB();
			const sourceBlobReq = await new Promise<Blob | undefined>((resolve, reject) => {
				const tx = db.transaction('imageBlobs', 'readonly');
				const req = tx.objectStore('imageBlobs').get(imageId);
				tx.oncomplete = () => resolve(req.result?.blob);
				tx.onerror = () => reject(tx.error);
			});

			const sourceThumbReq = await new Promise<Blob | undefined>((resolve, reject) => {
				const tx = db.transaction('thumbnailBlobs', 'readonly');
				const req = tx.objectStore('thumbnailBlobs').get(imageId);
				tx.oncomplete = () => resolve(req.result?.blob);
				tx.onerror = () => reject(tx.error);
			});

			const newId = crypto.randomUUID();
			const newImage: GalleryImage = {
				...source,
				id: newId,
				folderId: targetFolderId,
				addedAt: Date.now(),
			};

			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(['images', 'imageBlobs', 'thumbnailBlobs'], 'readwrite');
				tx.objectStore('images').put(newImage);
				if (sourceBlobReq) tx.objectStore('imageBlobs').put({ imageId: newId, blob: sourceBlobReq });
				if (sourceThumbReq) tx.objectStore('thumbnailBlobs').put({ imageId: newId, blob: sourceThumbReq });
				tx.oncomplete = () => {
					resolve();
					db.close();
				};
				tx.onerror = () => {
					reject(tx.error);
					db.close();
				};
			});

			return newImage;
		});
	}

	async deleteImage(imageId: string): Promise<void> {
		return this.withMutationLock(async () => {
			const db = await getDB();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(['images', 'imageBlobs', 'thumbnailBlobs'], 'readwrite');
				tx.objectStore('images').delete(imageId);
				tx.objectStore('imageBlobs').delete(imageId);
				tx.objectStore('thumbnailBlobs').delete(imageId);
				tx.oncomplete = () => {
					resolve();
					db.close();
				};
				tx.onerror = () => {
					reject(tx.error);
					db.close();
				};
			});
		});
	}

	async getImageBlob(imageId: string): Promise<Blob | undefined> {
		const db = await getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('imageBlobs', 'readonly');
			const request = tx.objectStore('imageBlobs').get(imageId);
			tx.oncomplete = () => {
				resolve(request.result?.blob);
				db.close();
			};
			tx.onerror = () => {
				reject(tx.error);
				db.close();
			};
		});
	}

	async getThumbnailBlob(imageId: string): Promise<Blob | undefined> {
		const db = await getDB();
		return new Promise((resolve, reject) => {
			const tx = db.transaction('thumbnailBlobs', 'readonly');
			const request = tx.objectStore('thumbnailBlobs').get(imageId);
			tx.oncomplete = () => {
				resolve(request.result?.blob);
				db.close();
			};
			tx.onerror = () => {
				reject(tx.error);
				db.close();
			};
		});
	}

	async clearAll(): Promise<void> {
		return this.withMutationLock(async () => {
			const db = await getDB();
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(['folders', 'images', 'imageBlobs', 'thumbnailBlobs'], 'readwrite');
				tx.objectStore('folders').clear();
				tx.objectStore('images').clear();
				tx.objectStore('imageBlobs').clear();
				tx.objectStore('thumbnailBlobs').clear();
				tx.oncomplete = () => {
					resolve();
					db.close();
				};
				tx.onerror = () => {
					reject(tx.error);
					db.close();
				};
			});
		});
	}
}

const RECENTS_KEY = 'image-editor-recents';
const RECENTS_MAX = 20;

export interface RecentEntry {
	path: string;
	fileName: string;
	thumbnail: string;
	openedAt: number;
}

export function getRecents(): RecentEntry[] {
	try {
		const raw = localStorage.getItem(RECENTS_KEY);
		return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
	} catch {
		return [];
	}
}

export function addRecentEntry(path: string, fileName: string, thumbnail: string): void {
	const entries = getRecents().filter((e) => e.path !== path);
	entries.unshift({ path, fileName, thumbnail, openedAt: Date.now() });
	localStorage.setItem(RECENTS_KEY, JSON.stringify(entries.slice(0, RECENTS_MAX)));
}

export function removeRecentEntry(path: string): void {
	const entries = getRecents().filter((e) => e.path !== path);
	localStorage.setItem(RECENTS_KEY, JSON.stringify(entries));
}

export function clearAllRecents(): void {
	localStorage.removeItem(RECENTS_KEY);
}

export const galleryStore = new GalleryStore();
