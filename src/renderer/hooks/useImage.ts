import type { Image } from 'image-js';
import { useCallback, useState, useRef } from 'react';

interface ImageState {
	currentImage: Image | null;
	originalImage: Image | null;
	fileName: string;

	// Adjustments
	blur: number;
	threshold: number;
	values: 2 | 3;
	showOriginal: boolean;

	// Counter
	counter: number;
	counterRunning: boolean;
	counterDuration: number | null;
}

export const useImage = () => {
	const [imageState, setImageState] = useState<ImageState>({
		currentImage: null,
		originalImage: null,
		fileName: '',
		blur: 0,
		threshold: 0,
		values: 2,
		showOriginal: false,
		counter: 0,
		counterRunning: false,
		counterDuration: null,
	});

	const {
		currentImage,
		originalImage,
		fileName,
		blur,
		threshold,
		values,
		showOriginal,
		counter,
		counterRunning,
		counterDuration,
	} = imageState;

	// Load image (already decoded)
	const loadImage = useCallback(async (image: Image, fileName: string = '') => {
		if (timerRef.current) clearInterval(timerRef.current);
		setImageState({
			currentImage: image.clone(),
			originalImage: image.clone(),
			fileName,
			blur: 0,
			threshold: 0,
			values: 2,
			showOriginal: false,
			counter: 0,
			counterRunning: false,
			counterDuration: null,
		});
	}, []);

	// Reset image (clear all)
	const resetImage = useCallback(() => {
		if (timerRef.current) clearInterval(timerRef.current);
		setImageState({
			currentImage: null,
			originalImage: null,
			fileName: '',
			blur: 0,
			threshold: 0,
			values: 2,
			showOriginal: false,
			counter: 0,
			counterRunning: false,
			counterDuration: null,
		});
	}, []);

	// Reset controls only (keep image)
	const resetControls = useCallback(() => {
		setImageState((prev) => ({
			...prev,
			blur: 0,
			threshold: 0,
			values: 2,
			showOriginal: false,
			counter: 0,
			counterRunning: false,
			counterDuration: null,
		}));
	}, []);

	// Adjustments setters
	const setBlur = useCallback((value: number) => {
		setImageState((prev) => ({ ...prev, blur: value }));
	}, []);

	const setThreshold = useCallback((value: number) => {
		setImageState((prev) => ({ ...prev, threshold: value }));
	}, []);

	const setValues = useCallback((value: 2 | 3) => {
		setImageState((prev) => ({ ...prev, values: value }));
	}, []);

	const toggleShowOriginal = useCallback(() => {
		setImageState((prev) => ({ ...prev, showOriginal: !prev.showOriginal }));
	}, []);

	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startCounter = useCallback((duration: number) => {
		if (timerRef.current) clearInterval(timerRef.current);
		setImageState((prev) => ({
			...prev,
			counter: duration,
			counterRunning: true,
			counterDuration: duration,
		}));
		timerRef.current = setInterval(() => {
			setImageState((prev) => {
				if (prev.counter <= 0) {
					if (timerRef.current) clearInterval(timerRef.current);
					timerRef.current = null;
					return { ...prev, counter: 0, counterRunning: false };
				}
				return { ...prev, counter: prev.counter - 1 };
			});
		}, 1000);
	}, []);

	const stopCounter = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setImageState((prev) => ({
			...prev,
			counterRunning: false,
		}));
	}, []);

	return {
		// State
		currentImage,
		originalImage,
		fileName,
		hasImage: !!currentImage,

		// Actions
		loadImage,
		resetImage,
		resetControls,

		// Values study adjustments
		blur,
		threshold,
		values,
		showOriginal,
		setBlur,
		setThreshold,
		setValues,
		toggleShowOriginal,

		// Counter
		counter,
		counterRunning,
		counterDuration,
		startCounter,
		stopCounter,
	};
};
