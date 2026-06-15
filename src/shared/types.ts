export const UNSORTED_FOLDER_NAME = 'Unsorted';

export interface RecentEntry {
	path: string;
	fileName: string;
	thumbnail: string;
	openedAt: number;
}

export interface GalleryFolder {
	id: string;
	name: string;
	tags: string[];
	createdAt: number;
	sortOrder: number;
}

export interface GalleryImage {
	id: string;
	folderId: string;
	fileName: string;
	width: number;
	height: number;
	fileSize: number;
	addedAt: number;
	source: 'local';
}

export interface GalleryData {
	version: 1;
	folders: GalleryFolder[];
	images: GalleryImage[];
}
