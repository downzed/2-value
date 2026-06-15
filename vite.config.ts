import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	root: resolve(__dirname, 'src/renderer'),
	plugins: [
		react(),
		tailwindcss(),
		{
			name: 'fix-file-type-eval',
			transform(code, id) {
				if (id.includes('node_modules/file-type/')) {
					return code.replace(/\beval\('require'\)/g, "(0, eval)('require')");
				}
			},
		},
	],
	build: {
		outDir: resolve(__dirname, 'dist'),
	},
});
