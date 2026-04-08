import type {
	RecentEntry,
	GalleryData,
	GalleryFolder,
	GalleryImage,
	ExternalSearchResult,
	ExternalImage,
} from '../shared/types';

interface OpenImageResult {
	path: string;
	fileName: string;
	fileSize: number;
}

declare global {
	interface Window {
		electronAPI: {
			openImage: () => Promise<OpenImageResult | null>;
			getImageInfo: (path: string) => Promise<OpenImageResult | null>;
			readImageBuffer: (path: string) => Promise<Uint8Array>;
			saveImage: (buffer: ArrayBuffer, defaultPath?: string) => Promise<string | null>;
			getRecents: () => Promise<RecentEntry[]>;
			removeRecent: (path: string) => Promise<void>;
			openImageFromPath: (path: string) => Promise<OpenImageResult | null>;
			// Gallery
			galleryGetData: () => Promise<GalleryData>;
			galleryCreateFolder: (name: string, tags?: string[]) => Promise<GalleryFolder>;
			galleryRenameFolder: (folderId: string, newName: string) => Promise<void>;
			galleryDeleteFolder: (folderId: string, deleteImages: boolean) => Promise<void>;
			galleryUpdateFolderTags: (folderId: string, tags: string[]) => Promise<void>;
			galleryReorderFolders: (orderedIds: string[]) => Promise<void>;
			galleryImportImage: (sourcePath: string, folderId: string) => Promise<GalleryImage>;
			galleryMoveImage: (imageId: string, targetFolderId: string) => Promise<void>;
			galleryCopyImage: (imageId: string, targetFolderId: string) => Promise<GalleryImage>;
			galleryDeleteImage: (imageId: string) => Promise<void>;
			galleryOpenImage: (imageId: string) => Promise<OpenImageResult>;
			galleryDownloadExternal: (
				url: string,
				folderId: string,
				metadata: { sourceId: string; author: string; authorUrl: string; description: string },
			) => Promise<GalleryImage>;
			gallerySearchImages: (query: string, page?: number) => Promise<ExternalSearchResult>;
			galleryRandomImages: (query?: string, count?: number) => Promise<ExternalImage[]>;
		};
	}
}
