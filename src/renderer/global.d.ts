export {};

interface RecentEntry {
	path: string;
	fileName: string;
	thumbnail: string;
	openedAt: number;
}

declare global {
	interface Window {
		electronAPI: {
			openImage: () => Promise<{ dataUrl: string; path: string } | null>;
			saveImage: (dataUrl: string, defaultPath?: string) => Promise<string | null>;
			getRecents: () => Promise<RecentEntry[]>;
			removeRecent: (path: string) => Promise<void>;
			openImageFromPath: (path: string) => Promise<{ dataUrl: string; path: string } | null>;
		};
	}
}
