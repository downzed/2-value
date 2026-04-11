import { readImg } from 'image-js';
import { useCallback } from 'react';
import { useImageContext } from './ImageContext';

export function useImageLoader() {
	const { loadImage } = useImageContext();

	const loadFromDataUrl = useCallback(
		async (dataUrl: string, filePath: string) => {
			const img = new window.Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Failed to load image element'));
				img.src = dataUrl;
			});
			const image = readImg(img);
			const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';
			await loadImage(image, fileName, filePath);
		},
		[loadImage],
	);

	return { loadFromDataUrl };
}
