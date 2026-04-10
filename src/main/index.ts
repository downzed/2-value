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

function getRecentsPath(): string {
	return path.join(app.getPath('userData'), 'recents.json');
}

function loadRecents(): RecentEntry[] {
	try {
		const data = fs.readFileSync(getRecentsPath(), 'utf-8');
		return JSON.parse(data);
	} catch {
		return [];
	}
}

function saveRecents(entries: RecentEntry[]): void {
	fs.writeFileSync(getRecentsPath(), JSON.stringify(entries, null, 2));
}

function addRecentEntry(filePath: string): void {
	const entries = loadRecents().filter((e) => e.path !== filePath);
	const image = nativeImage.createFromPath(filePath);
	const thumbnail = image.resize({ width: 100 }).toDataURL();
	entries.unshift({
		path: filePath,
		fileName: path.basename(filePath),
		thumbnail,
		openedAt: Date.now(),
	});
	saveRecents(entries.slice(0, RECENTS_MAX));
}

function removeRecentEntry(filePath: string): void {
	const entries = loadRecents().filter((e) => e.path !== filePath);
	saveRecents(entries);
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
		addRecentEntry(filePaths[0]);
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

ipcMain.handle('get-recents', () => loadRecents());

ipcMain.handle('add-recent', (_event, { path: filePath }) => addRecentEntry(filePath));

ipcMain.handle('remove-recent', (_event, { path: filePath }) => removeRecentEntry(filePath));

ipcMain.handle('open-image-from-path', (_event, { path: filePath }) => {
	if (!fs.existsSync(filePath)) {
		removeRecentEntry(filePath);
		return null;
	}
	const image = nativeImage.createFromPath(filePath);
	addRecentEntry(filePath);
	return {
		dataUrl: image.toDataURL(),
		path: filePath,
	};
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
