// Preload scripts for IPC bridge
import { contextBridge, ipcRenderer } from 'electron';

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
	// Gallery
	galleryGetData: () => ipcRenderer.invoke('gallery:get-data'),
	galleryCreateFolder: (name: string, tags?: string[]) => ipcRenderer.invoke('gallery:create-folder', { name, tags }),
	galleryRenameFolder: (folderId: string, newName: string) =>
		ipcRenderer.invoke('gallery:rename-folder', { folderId, newName }),
	galleryDeleteFolder: (folderId: string, deleteImages: boolean) =>
		ipcRenderer.invoke('gallery:delete-folder', { folderId, deleteImages }),
	galleryUpdateFolderTags: (folderId: string, tags: string[]) =>
		ipcRenderer.invoke('gallery:update-folder-tags', { folderId, tags }),
	galleryReorderFolders: (orderedIds: string[]) => ipcRenderer.invoke('gallery:reorder-folders', { orderedIds }),
	galleryImportImage: (sourcePath: string, folderId: string) =>
		ipcRenderer.invoke('gallery:import-image', { sourcePath, folderId }),
	galleryMoveImage: (imageId: string, targetFolderId: string) =>
		ipcRenderer.invoke('gallery:move-image', { imageId, targetFolderId }),
	galleryCopyImage: (imageId: string, targetFolderId: string) =>
		ipcRenderer.invoke('gallery:copy-image', { imageId, targetFolderId }),
	galleryDeleteImage: (imageId: string) => ipcRenderer.invoke('gallery:delete-image', { imageId }),
	galleryOpenImage: (imageId: string) => ipcRenderer.invoke('gallery:open-image', { imageId }),
	galleryDownloadExternal: (
		url: string,
		folderId: string,
		metadata: { sourceId: string; author: string; authorUrl: string; description: string },
	) => ipcRenderer.invoke('gallery:download-external', { url, folderId, metadata }),
	gallerySearchImages: (query: string, page?: number) => ipcRenderer.invoke('gallery:search-images', { query, page }),
	galleryRandomImages: (query?: string, count?: number) =>
		ipcRenderer.invoke('gallery:random-images', { query, count }),
});
