// Modules to control application life and create native browser window
import electron from 'electron';

const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol, net } = electron;

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RecentEntry } from '../shared/types';
import {
	initGallery,
	loadGallery,
	getImagePath,
	importImage,
	moveImage,
	copyImage,
	deleteImage,
	createFolder,
	renameFolder,
	deleteFolder,
	updateFolderTags,
	reorderFolders,
	downloadExternalImage,
	getThumbnailsDir,
} from './gallery';

// --- Recents storage ---

const RECENTS_MAX = 20;

let recentsCache: RecentEntry[] | null = null;

function getRecentsPath(): string {
	return path.join(app.getPath('userData'), 'recents.json');
}

async function loadRecents(): Promise<RecentEntry[]> {
	if (recentsCache) return recentsCache;
	try {
		const data = await fs.promises.readFile(getRecentsPath(), 'utf-8');
		const parsed: unknown = JSON.parse(data);
		recentsCache = Array.isArray(parsed) ? parsed : [];
	} catch {
		recentsCache = [];
	}
	return recentsCache;
}

async function saveRecents(entries: RecentEntry[]): Promise<void> {
	recentsCache = entries;
	await fs.promises.writeFile(getRecentsPath(), JSON.stringify(entries, null, 2));
}

async function addRecentEntry(filePath: string): Promise<void> {
	const entries = (await loadRecents()).filter((e) => e.path !== filePath);
	const image = nativeImage.createFromPath(filePath);
	if (image.isEmpty()) return; // skip — not a valid image
	const thumbnail = image.resize({ width: 100 }).toDataURL();
	entries.unshift({
		path: filePath,
		fileName: path.basename(filePath),
		thumbnail,
		openedAt: Date.now(),
	});
	await saveRecents(entries.slice(0, RECENTS_MAX));
}

async function removeRecentEntry(filePath: string): Promise<void> {
	const entries = (await loadRecents()).filter((e) => e.path !== filePath);
	await saveRecents(entries);
}

function isInRecents(filePath: string): boolean {
	if (!recentsCache) return false; // cache not yet loaded
	return recentsCache.some((e) => e.path === filePath);
}

// --- Window ---

let mainWindow: electron.BrowserWindow | null = null;

/**
 * Tracks paths the user has explicitly opened (via dialog or recents).
 * Currently used to validate read-image-buffer requests.
 */
const allowedPaths = new Set<string>();

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		backgroundMaterial: 'auto',
		center: true,
		webPreferences: {
			preload: path.join(__dirname, '../preload/index.mjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false, // Required: preload script uses Node.js APIs (path, fs) for IPC bridge
		},
	});

	if (process.env.NODE_ENV === 'development') {
		mainWindow.webContents.openDevTools();
	}
	// and load the index.html of the app.
	// In development, load from Vite dev server
	// In production, load the built HTML file
	if (process.env.NODE_ENV === 'development') {
		mainWindow.loadURL('http://localhost:5173');
	} else {
		const indexPath = path.join(__dirname, '../renderer/index.html');
		mainWindow.loadFile(indexPath);
	}

	mainWindow.on('closed', () => {
		mainWindow = null;
	});

	mainWindow.webContents.on('will-navigate', (event, url) => {
		event.preventDefault();
		shell.openExternal(url);
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
	// Register gallery thumbnail protocol before window creation
	protocol.handle('gallery-thumb', (request) => {
		const imageId = new URL(request.url).hostname;
		// Validate that imageId is a UUID (no path separators or other components)
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(imageId)) {
			return new Response('Not Found', { status: 404 });
		}
		const thumbPath = path.join(getThumbnailsDir(), `${imageId}_thumb.png`);
		return net.fetch(pathToFileURL(thumbPath).toString());
	});

	await initGallery();
	createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it is common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) createWindow();
});

// --- Image IPC handlers ---

/**
 * Open image: shows file dialog and returns path + metadata only.
 * No data URL transport — renderer fetches bytes separately via read-image-buffer.
 */
ipcMain.handle('open-image', async () => {
	const { filePaths } = await dialog.showOpenDialog({
		properties: ['openFile'],
		filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
	});
	if (filePaths[0]) {
		const filePath = filePaths[0];
		const resolvedPath = path.resolve(filePath);
		const stat = await fs.promises.stat(resolvedPath);
		await addRecentEntry(resolvedPath);
		allowedPaths.add(resolvedPath);
		return {
			path: resolvedPath,
			fileName: path.basename(resolvedPath),
			fileSize: stat.size,
		};
	}
	return null;
});

/**
 * Get image info (path, fileName, fileSize) without reading pixel data.
 */
ipcMain.handle('get-image-info', async (_event, { path: filePath }: { path: string }) => {
	const resolvedPath = path.resolve(filePath);
	try {
		const stat = await fs.promises.stat(resolvedPath);
		return {
			path: resolvedPath,
			fileName: path.basename(resolvedPath),
			fileSize: stat.size,
		};
	} catch {
		return null;
	}
});

/**
 * Read image as raw bytes (Uint8Array). Renderer decodes with createImageBitmap.
 */
ipcMain.handle('read-image-buffer', async (_event, { path: filePath }: { path: string }) => {
	const resolvedPath = path.resolve(filePath);
	if (!allowedPaths.has(resolvedPath)) {
		throw new Error('Access denied: path not opened by user');
	}
	const buffer = await fs.promises.readFile(resolvedPath);
	// Return as Uint8Array — Electron serialises Buffer as Uint8Array over IPC
	return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
});

/**
 * Save image: accepts binary ArrayBuffer from canvas.toBlob(), avoids base64.
 */
ipcMain.handle('save-image', async (_event, { buffer, defaultPath }: { buffer: ArrayBuffer; defaultPath?: string }) => {
	if (!mainWindow) return null;
	const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
		title: 'Save Image',
		defaultPath: defaultPath || 'untitled.png',
		filters: [
			{ name: 'PNG', extensions: ['png'] },
			{ name: 'JPEG', extensions: ['jpg', 'jpeg'] },
		],
	});
	if (canceled || !filePath) return null;

	await fs.promises.writeFile(filePath, Buffer.from(buffer));
	return filePath;
});

// --- Recents IPC handlers ---

ipcMain.handle('get-recents', async () => loadRecents());

ipcMain.handle('remove-recent', async (_event, { path: filePath }) => removeRecentEntry(filePath));

ipcMain.handle('open-image-from-path', async (_event, { path: filePath }) => {
	const resolvedPath = path.resolve(filePath);
	await loadRecents();
	if (!isInRecents(resolvedPath)) {
		return null;
	}
	if (!fs.existsSync(resolvedPath)) {
		await removeRecentEntry(resolvedPath);
		return null;
	}
	const stat = await fs.promises.stat(resolvedPath);
	await addRecentEntry(resolvedPath);
	allowedPaths.add(resolvedPath);
	return {
		path: resolvedPath,
		fileName: path.basename(resolvedPath),
		fileSize: stat.size,
	};
});

// --- Gallery IPC handlers ---

ipcMain.handle('gallery:get-data', () => loadGallery());

ipcMain.handle('gallery:create-folder', (_event, { name, tags }: { name: string; tags?: string[] }) =>
	createFolder(name, tags),
);

ipcMain.handle('gallery:rename-folder', (_event, { folderId, newName }: { folderId: string; newName: string }) =>
	renameFolder(folderId, newName),
);

ipcMain.handle(
	'gallery:delete-folder',
	(_event, { folderId, deleteImages }: { folderId: string; deleteImages: boolean }) =>
		deleteFolder(folderId, deleteImages),
);

ipcMain.handle('gallery:update-folder-tags', (_event, { folderId, tags }: { folderId: string; tags: string[] }) =>
	updateFolderTags(folderId, tags),
);

ipcMain.handle('gallery:reorder-folders', (_event, { orderedIds }: { orderedIds: string[] }) =>
	reorderFolders(orderedIds),
);

ipcMain.handle(
	'gallery:import-image',
	(_event, { sourcePath, folderId }: { sourcePath: string; folderId: string }) => importImage(sourcePath, folderId),
);

ipcMain.handle('gallery:move-image', (_event, { imageId, targetFolderId }: { imageId: string; targetFolderId: string }) =>
	moveImage(imageId, targetFolderId),
);

ipcMain.handle(
	'gallery:copy-image',
	(_event, { imageId, targetFolderId }: { imageId: string; targetFolderId: string }) =>
		copyImage(imageId, targetFolderId),
);

ipcMain.handle('gallery:delete-image', (_event, { imageId }: { imageId: string }) => deleteImage(imageId));

ipcMain.handle('gallery:open-image', async (_event, { imageId }: { imageId: string }) => {
	const storedPath = getImagePath(imageId);
	if (!fs.existsSync(storedPath)) throw new Error('Gallery image file not found');
	const stat = await fs.promises.stat(storedPath);
	allowedPaths.add(storedPath);
	return {
		path: storedPath,
		fileName: path.basename(storedPath),
		fileSize: stat.size,
	};
});

ipcMain.handle(
	'gallery:download-external',
	(
		_event,
		{
			url,
			folderId,
			metadata,
		}: {
			url: string;
			folderId: string;
			metadata: { sourceId: string; author: string; authorUrl: string; description: string };
		},
	) => downloadExternalImage(url, folderId, metadata),
);

ipcMain.handle('gallery:search-images', () => {
	throw new Error('SourceSplash not configured');
});

ipcMain.handle('gallery:random-images', () => {
	throw new Error('SourceSplash not configured');
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
