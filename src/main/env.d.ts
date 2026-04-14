/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly MAIN_VITE_SOURCESPLASH_API_KEY?: string;
	readonly MAIN_VITE_PEXELS_API_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
