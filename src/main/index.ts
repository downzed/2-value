// Modules to control application life and create native browser window
import electron, { type BaseWindow } from 'electron';

const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = electron;

import fs from 'node:fs';
import path from 'node:path';

let mainWindow: electron.BrowserWindow | null = null;

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		fullscreenable: true,
		transparent: true,
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
		return {
			dataUrl,
			path: filePaths[0],
		};
	}
	return null;
});

ipcMain.handle('save-image', async (_event, { dataUrl }) => {
	const { filePath, canceled } = await dialog.showSaveDialog(mainWindow as BaseWindow, {
		title: 'Save Image',
		defaultPath: 'untitled.png',
		filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
	});
	if (canceled || !filePath) return null;

	const image = nativeImage.createFromDataURL(dataUrl);
	const pngData = image.toPNG();
	await fs.promises.writeFile(filePath, pngData);
	return filePath;
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
