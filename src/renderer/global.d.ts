import type { RecentEntry } from '../shared/types';

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
		};
	}
}
