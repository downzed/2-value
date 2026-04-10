import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
	main: {
		// Main process vite config
		build: {
			outDir: 'dist/main',
			rollupOptions: {
				input: resolve(__dirname, 'src/main/index.ts'),
				external: ['electron', 'path', 'fs', 'events'],
			},
		},
	},
	preload: {
		// Preload scripts vite config
		build: {
			outDir: 'dist/preload',
			rollupOptions: {
				input: resolve(__dirname, 'src/preload/index.ts'),
				external: ['electron'],
			},
		},
	},
	renderer: {
		// Renderer process vite config
		build: {
			outDir: 'dist/renderer',
			rollupOptions: {
				input: resolve(__dirname, 'src/renderer/index.html'),
			},
		},
		plugins: [react(), tailwindcss()],
	},
});
