// Preload scripts for IPC bridge
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	openImage: () => ipcRenderer.invoke('open-image'),
	saveImage: (dataUrl: string, defaultPath?: string) => ipcRenderer.invoke('save-image', { dataUrl, defaultPath }),
	getRecents: () => ipcRenderer.invoke('get-recents'),
	removeRecent: (path: string) => ipcRenderer.invoke('remove-recent', { path }),
	openImageFromPath: (path: string) => ipcRenderer.invoke('open-image-from-path', { path }),
});
