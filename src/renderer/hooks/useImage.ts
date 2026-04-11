import type { Image } from 'image-js';
import { useCallback, useState, useRef } from 'react';
import { UI } from '../constants/ui';

type PanelId = 'controls' | 'original' | 'timer';

interface AdjustmentSnapshot {
	blur: number;
	threshold: number;
	values: 2 | 3;
}

interface ImageState {
	currentImage: Image | null;
	originalImage: Image | null;
	fileName: string;
	filePath: string;

	// Adjustments
	blur: number;
	threshold: number;
	values: 2 | 3;
	showOriginal: boolean;

	// Counter
	counter: number;
	counterRunning: boolean;
	counterDuration: number | null;

	// Panel visibility
	panels: Record<PanelId, boolean>;

	// Undo/redo
	adjustmentHistory: AdjustmentSnapshot[];
	adjustmentFuture: AdjustmentSnapshot[];
}

const DEFAULT_PANELS: Record<PanelId, boolean> = {
	controls: true,
	original: true,
	timer: true,
};

function getSnapshot(state: ImageState): AdjustmentSnapshot {
	return { blur: state.blur, threshold: state.threshold, values: state.values };
}

function pushHistory(history: AdjustmentSnapshot[], snapshot: AdjustmentSnapshot): AdjustmentSnapshot[] {
	const next = [...history, snapshot];
	if (next.length > UI.HISTORY.MAX_DEPTH) {
		return next.slice(next.length - UI.HISTORY.MAX_DEPTH);
	}
	return next;
}

export const useImage = () => {
	const [imageState, setImageState] = useState<ImageState>({
		currentImage: null,
		originalImage: null,
		fileName: '',
		filePath: '',
		blur: 0,
		threshold: 0,
		values: 2,
		showOriginal: false,
		counter: 0,
		counterRunning: false,
		counterDuration: null,
		panels: { ...DEFAULT_PANELS },
		adjustmentHistory: [],
		adjustmentFuture: [],
	});

	const {
		currentImage,
		originalImage,
		fileName,
		filePath,
		blur,
		threshold,
		values,
		showOriginal,
		counter,
		counterRunning,
		counterDuration,
		panels,
		adjustmentHistory,
		adjustmentFuture,
	} = imageState;

	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Load image (already decoded)
	const loadImage = useCallback(async (image: Image, fileName = '', filePath = '') => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setImageState({
			currentImage: image.clone(),
			originalImage: image.clone(),
			fileName,
			filePath,
			blur: 0,
			threshold: 0,
			values: 2,
			showOriginal: false,
			counter: 0,
			counterRunning: false,
			counterDuration: null,
			panels: { controls: true, original: true, timer: true },
			adjustmentHistory: [],
			adjustmentFuture: [],
		});
	}, []);

	// Reset image (clear all)
	const resetImage = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setImageState({
			currentImage: null,
			originalImage: null,
			fileName: '',
			filePath: '',
			blur: 0,
			threshold: 0,
			values: 2,
			showOriginal: false,
			counter: 0,
			counterRunning: false,
			counterDuration: null,
			panels: { ...DEFAULT_PANELS },
			adjustmentHistory: [],
			adjustmentFuture: [],
		});
	}, []);

	// Reset controls only (keep image)
	const resetControls = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setImageState((prev) => ({
			...prev,
			blur: 0,
			threshold: 0,
			values: 2,
			showOriginal: false,
			counter: 0,
			counterRunning: false,
			counterDuration: null,
			adjustmentHistory: [],
			adjustmentFuture: [],
		}));
	}, []);

	// Adjustments setters (with undo history)
	const setBlur = useCallback((value: number) => {
		setImageState((prev) => ({
			...prev,
			blur: value,
			adjustmentHistory: pushHistory(prev.adjustmentHistory, getSnapshot(prev)),
			adjustmentFuture: [],
		}));
	}, []);

	const setThreshold = useCallback((value: number) => {
		setImageState((prev) => ({
			...prev,
			threshold: value,
			adjustmentHistory: pushHistory(prev.adjustmentHistory, getSnapshot(prev)),
			adjustmentFuture: [],
		}));
	}, []);

	const setValues = useCallback((value: 2 | 3) => {
		setImageState((prev) => ({
			...prev,
			values: value,
			adjustmentHistory: pushHistory(prev.adjustmentHistory, getSnapshot(prev)),
			adjustmentFuture: [],
		}));
	}, []);

	const toggleShowOriginal = useCallback(() => {
		setImageState((prev) => ({ ...prev, showOriginal: !prev.showOriginal }));
	}, []);

	// Apply a preset (single undo entry)
	const applyPreset = useCallback((preset: { blur: number; threshold: number; values: 2 | 3 }) => {
		setImageState((prev) => ({
			...prev,
			blur: preset.blur,
			threshold: preset.threshold,
			values: preset.values,
			adjustmentHistory: pushHistory(prev.adjustmentHistory, getSnapshot(prev)),
			adjustmentFuture: [],
		}));
	}, []);

	// Undo/Redo
	const undo = useCallback(() => {
		setImageState((prev) => {
			if (prev.adjustmentHistory.length === 0) return prev;
			const history = [...prev.adjustmentHistory];
			const snapshot = history[history.length - 1];
			history.pop();
			return {
				...prev,
				blur: snapshot.blur,
				threshold: snapshot.threshold,
				values: snapshot.values,
				adjustmentHistory: history,
				adjustmentFuture: [...prev.adjustmentFuture, getSnapshot(prev)],
			};
		});
	}, []);

	const redo = useCallback(() => {
		setImageState((prev) => {
			if (prev.adjustmentFuture.length === 0) return prev;
			const future = [...prev.adjustmentFuture];
			const snapshot = future[future.length - 1];
			future.pop();
			return {
				...prev,
				blur: snapshot.blur,
				threshold: snapshot.threshold,
				values: snapshot.values,
				adjustmentHistory: [...prev.adjustmentHistory, getSnapshot(prev)],
				adjustmentFuture: future,
			};
		});
	}, []);

	// Panel visibility
	const togglePanel = useCallback((panel: PanelId) => {
		setImageState((prev) => ({
			...prev,
			panels: { ...prev.panels, [panel]: !prev.panels[panel] },
		}));
	}, []);

	const setPanel = useCallback((panel: PanelId, open: boolean) => {
		setImageState((prev) => ({
			...prev,
			panels: { ...prev.panels, [panel]: open },
		}));
	}, []);

	// Counter
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
		filePath,
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

		// Presets
		applyPreset,

		// Undo/Redo
		undo,
		redo,
		canUndo: adjustmentHistory.length > 0,
		canRedo: adjustmentFuture.length > 0,

		// Panel visibility
		panels,
		togglePanel,
		setPanel,

		// Counter
		counter,
		counterRunning,
		counterDuration,
		startCounter,
		stopCounter,
	};
};
