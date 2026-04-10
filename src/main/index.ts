// Modules to control application life and create native browser window
import electron, { type BaseWindow } from 'electron';

const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = electron;

import fs from 'node:fs';
import path from 'node:path';

// --- Recents storage ---

interface RecentEntry {
	path: string;
	fileName: string;
	thumbnail: string;
	openedAt: number;
}

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
	return recentsCache?.some((e) => e.path === filePath) ?? false;
}

// --- Window ---

let mainWindow: electron.BrowserWindow | null = null;

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		backgroundMaterial: 'auto',
		center: true,
		webPreferences: {
			preload: path.join(__dirname, '../preload/index.mjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
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
app.whenReady().then(createWindow);

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

ipcMain.handle('open-image', async () => {
	const { filePaths } = await dialog.showOpenDialog({
		properties: ['openFile'],
		filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
	});
	if (filePaths[0]) {
		const image = nativeImage.createFromPath(filePaths[0]);
		const dataUrl = image.toDataURL();
		await addRecentEntry(filePaths[0]);
		return {
			dataUrl,
			path: filePaths[0],
		};
	}
	return null;
});

ipcMain.handle('save-image', async (_event, { dataUrl, defaultPath }) => {
	const { filePath, canceled } = await dialog.showSaveDialog(mainWindow as BaseWindow, {
		title: 'Save Image',
		defaultPath: defaultPath || 'untitled.png',
		filters: [
			{ name: 'PNG', extensions: ['png'] },
			{ name: 'JPEG', extensions: ['jpg', 'jpeg'] },
		],
	});
	if (canceled || !filePath) return null;

	const image = nativeImage.createFromDataURL(dataUrl);
	const ext = path.extname(filePath).toLowerCase();
	const buffer = ext === '.jpg' || ext === '.jpeg' ? image.toJPEG(90) : image.toPNG();
	await fs.promises.writeFile(filePath, buffer);
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
	const image = nativeImage.createFromPath(resolvedPath);
	await addRecentEntry(resolvedPath);
	return {
		dataUrl: image.toDataURL(),
		path: resolvedPath,
	};
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
