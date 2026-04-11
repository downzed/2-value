// Preload scripts for IPC bridge
import { contextBridge, ipcRenderer } from 'electron';
import type { PinterestAuthResult, SavePinArgs, SavePinResult, PinterestBoard } from '../shared/pinterest-types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	openImage: () => ipcRenderer.invoke('open-image'),
	getImageInfo: (path: string) => ipcRenderer.invoke('get-image-info', { path }),
	readImageBuffer: (path: string) => ipcRenderer.invoke('read-image-buffer', { path }),
	saveImage: (buffer: ArrayBuffer, defaultPath?: string) => ipcRenderer.invoke('save-image', { buffer, defaultPath }),
	getRecents: () => ipcRenderer.invoke('get-recents'),
	removeRecent: (path: string) => ipcRenderer.invoke('remove-recent', { path }),
	openImageFromPath: (path: string) => ipcRenderer.invoke('open-image-from-path', { path }),

	// Pinterest integration
	pinterestAuth: (): Promise<PinterestAuthResult> => ipcRenderer.invoke('pinterest:auth'),
	pinterestAuthCallback: (code: string, state: string): Promise<PinterestAuthResult> =>
		ipcRenderer.invoke('pinterest:auth-callback', { code, state }),
	pinterestAuthStatus: (): Promise<{ authenticated: boolean }> => ipcRenderer.invoke('pinterest:auth-status'),
	pinterestLogout: (): Promise<void> => ipcRenderer.invoke('pinterest:logout'),
	pinterestGetBoards: (): Promise<PinterestBoard[]> => ipcRenderer.invoke('pinterest:get-boards'),
	pinterestSavePin: (args: SavePinArgs): Promise<SavePinResult> => ipcRenderer.invoke('pinterest:save-pin', args),
});
