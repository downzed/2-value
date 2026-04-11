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
	originalPath: string;
	storedFileName: string;
	thumbnailFileName: string;
	width: number;
	height: number;
	fileSize: number;
	addedAt: number;
	source: 'local' | 'sourcesplash';
	sourceMetadata?: {
		sourceId: string;
		author: string;
		authorUrl: string;
		description: string;
	};
}

export interface GalleryData {
	version: 1;
	folders: GalleryFolder[];
	images: GalleryImage[];
}

export interface SourceSplashImage {
	id: string;
	url: string;
	thumbnail: string;
	width: number;
	height: number;
	author: string;
	authorUrl: string;
	source: string;
	description: string;
}

export interface SourceSplashSearchResult {
	images: SourceSplashImage[];
	page: number;
	hasMore: boolean;
}
