import type { Image } from 'image-js';
import { useCallback, useMemo, useRef, useState } from 'react';
import { UI } from '../constants/ui';

type PanelId = 'controls' | 'original' | 'timer' | 'gallery';

interface AdjustmentSnapshot {
	blur: number;
	threshold: number;
	values: 2 | 3;
}

type FitMode = 'fit' | 'manual';

type CanvasMode = 'image' | 'blank';

interface Viewport {
	width: number;
	height: number;
}

/** Flat [x0, y0, x1, y1, ...] with coordinates normalized to 0..1. Blank canvases only. */
export type Stroke = number[];

export interface OpenItem {
	id: string;
	/** 'image' flows through the filter worker; 'blank' bypasses it and is a drawing surface. */
	kind: CanvasMode;
	/** Row label in the open-items widget. */
	label: string;
	fileName: string;
	image: Image | null;
	width: number;
	height: number;
	/** Set when the item is backed by an IndexedDB gallery entry, which makes it restorable. */
	galleryImageId: string | null;
	/** Identity used to avoid opening the same source twice; null for blank canvases. */
	dedupeKey: string | null;
	thumbUrl: string | null;
	blur: number;
	threshold: number;
	values: 2 | 3;
	showOriginal: boolean;
	/** Per-item undo history — never shared across items. */
	history: AdjustmentSnapshot[];
	future: AdjustmentSnapshot[];
	/** Set once adjustments or strokes change; cleared by Save. */
	dirty: boolean;
}

/** State that belongs to the app, not to any one item. */
interface GlobalState {
	viewport: Viewport;
	zoom: number;
	fitMode: FitMode;
	fitScale: number;
	counter: number;
	counterRunning: boolean;
	counterDuration: number | null;
	panels: Record<PanelId, boolean>;
}

const DEFAULT_PANELS: Record<PanelId, boolean> = {
	controls: true,
	original: true,
	timer: true,
	gallery: false,
};

const DEFAULT_VIEWPORT: Viewport = { width: 0, height: 0 };

function createDefaultGlobalState(): GlobalState {
	return {
		viewport: DEFAULT_VIEWPORT,
		zoom: 1,
		fitMode: 'fit',
		fitScale: 1,
		counter: 0,
		counterRunning: false,
		counterDuration: null,
		panels: { ...DEFAULT_PANELS },
	};
}

function createAdjustments() {
	return { blur: 0, threshold: 0, values: 2 as const, showOriginal: false };
}

function snapshotOf(item: OpenItem): AdjustmentSnapshot {
	return { blur: item.blur, threshold: item.threshold, values: item.values };
}

function pushHistory(history: AdjustmentSnapshot[], snapshot: AdjustmentSnapshot): AdjustmentSnapshot[] {
	const next = [...history, snapshot];
	if (next.length > UI.HISTORY.MAX_DEPTH) {
		return next.slice(next.length - UI.HISTORY.MAX_DEPTH);
	}
	return next;
}

/** Applies `updater` to the active item, leaving every other item untouched. */
function updateActive(
	items: OpenItem[],
	activeItemId: string | null,
	updater: (item: OpenItem) => OpenItem,
): OpenItem[] {
	if (activeItemId === null) return items;
	let changed = false;
	const next = items.map((item) => {
		if (item.id !== activeItemId) return item;
		changed = true;
		return updater(item);
	});
	return changed ? next : items;
}

export interface OpenImageMeta {
	/** Gallery entry backing this item. Presence makes the item restorable. */
	galleryImageId?: string | null;
	thumbUrl?: string | null;
	/** Identifies the already-open row to reactivate instead of adding a duplicate. */
	dedupeKey?: string | null;
}

export const useImage = () => {
	const [globalState, setGlobalState] = useState<GlobalState>(createDefaultGlobalState);
	const [items, setItems] = useState<OpenItem[]>([]);
	const [activeItemId, setActiveItemId] = useState<string | null>(null);

	/**
	 * Strokes are held in a mutable map keyed by item id rather than in state.
	 * Two reasons: painting must not re-render the tree on every pointermove, and
	 * keying by id makes switching items restore the right drawing for free.
	 */
	const strokesByItemRef = useRef<Map<string, Stroke[]>>(new Map());

	const idCounterRef = useRef(0);
	const nextItemId = useCallback(() => `item-${++idCounterRef.current}`, []);

	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const activeItem = useMemo(
		() => (activeItemId === null ? null : (items.find((i) => i.id === activeItemId) ?? null)),
		[items, activeItemId],
	);

	const canvasMode: CanvasMode = activeItem?.kind ?? 'image';
	const sourceImage = activeItem?.image ?? null;

	/** Clears the interval and marks the counter stopped. */
	const stopTimer = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setGlobalState((prev) => (prev.counterRunning ? { ...prev, counterRunning: false } : prev));
	}, []);

	/**
	 * Zoom is app-global, so reset to fit whenever the active document changes —
	 * a newly opened or activated item should never inherit another's zoom.
	 */
	const resetZoomToFit = useCallback(() => {
		setGlobalState((prev) => (prev.zoom === 1 && prev.fitMode === 'fit' ? prev : { ...prev, zoom: 1, fitMode: 'fit' }));
	}, []);

	// -------------------------------------------------------------------------
	// Opening and closing items
	// -------------------------------------------------------------------------

	/**
	 * Opens a photo as an item and activates it. Passing a `dedupeKey` (or a
	 * galleryImageId) reactivates an already-open row instead of duplicating it,
	 * unless that row has unsaved changes.
	 */
	const loadImage = useCallback(
		async (image: Image, fileName = '', meta: OpenImageMeta = {}) => {
			stopTimer();
			resetZoomToFit();
			const key = meta.dedupeKey ?? meta.galleryImageId ?? null;
			const existing = key === null ? undefined : items.find((i) => i.dedupeKey === key && !i.dirty);

			if (existing) {
				setActiveItemId(existing.id);
				return;
			}

			const id = nextItemId();
			const item: OpenItem = {
				id,
				kind: 'image',
				label: fileName || 'Untitled image',
				fileName,
				image,
				width: image.width,
				height: image.height,
				galleryImageId: meta.galleryImageId ?? null,
				thumbUrl: meta.thumbUrl ?? null,
				dedupeKey: key,
				...createAdjustments(),
				history: [],
				future: [],
				dirty: false,
			};
			setItems((prev) => [...prev, item]);
			setActiveItemId(id);
		},
		[items, nextItemId, stopTimer, resetZoomToFit],
	);

	/** New blank canvas. Each call creates a distinct item so canvases stack in the list. */
	const newBlankCanvas = useCallback(() => {
		stopTimer();
		resetZoomToFit();
		const id = nextItemId();
		let blankCount = 0;
		setItems((prev) => {
			blankCount = prev.filter((i) => i.kind === 'blank').length;
			const item: OpenItem = {
				id,
				kind: 'blank',
				label: `Canvas ${blankCount + 1}`,
				fileName: '',
				image: null,
				width: 0,
				height: 0,
				galleryImageId: null,
				thumbUrl: null,
				dedupeKey: null,
				...createAdjustments(),
				history: [],
				future: [],
				dirty: false,
			};
			return [...prev, item];
		});
		setActiveItemId(id);
	}, [nextItemId, stopTimer, resetZoomToFit]);

	/** Switches the active item, preserving every item's own state and drawing. */
	const activateItem = useCallback(
		(id: string) => {
			resetZoomToFit();
			setActiveItemId(id);
		},
		[resetZoomToFit],
	);

	/** Closes an item and drops its strokes. Returns the item so callers can confirm first. */
	const closeItem = useCallback(
		(id: string): OpenItem | null => {
			const closing = items.find((i) => i.id === id) ?? null;
			if (!closing) return null;

			strokesByItemRef.current.delete(id);
			setItems((prev) => prev.filter((i) => i.id !== id));
			setActiveItemId((current) => {
				if (current !== id) return current;
				const remaining = items.filter((i) => i.id !== id);
				return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
			});
			return closing;
		},
		[items],
	);

	/** Close everything. */
	const resetImage = useCallback(() => {
		stopTimer();
		resetZoomToFit();
		strokesByItemRef.current.clear();
		setItems([]);
		setActiveItemId(null);
	}, [stopTimer, resetZoomToFit]);

	// -------------------------------------------------------------------------
	// Saving / dirty tracking
	// -------------------------------------------------------------------------

	/** Marks the active item clean — called after a successful Save. */
	const markActiveSaved = useCallback(() => {
		setItems((prev) => prev.map((i) => (activeItemId !== null && i.id === activeItemId ? { ...i, dirty: false } : i)));
	}, [activeItemId]);

	/** Links an item to its gallery entry, making it restorable after a reload. */
	const linkGalleryImage = useCallback((itemId: string, galleryImageId: string, thumbUrl?: string | null) => {
		setItems((prev) =>
			prev.map((i) =>
				i.id === itemId ? { ...i, galleryImageId, thumbUrl: thumbUrl ?? i.thumbUrl, dedupeKey: galleryImageId } : i,
			),
		);
	}, []);

	/** Flags the active item as having unsaved changes (after a stroke is committed). */
	const markActiveDirty = useCallback(() => {
		setItems((prev) =>
			prev.map((i) => (activeItemId !== null && i.id === activeItemId && !i.dirty ? { ...i, dirty: true } : i)),
		);
	}, [activeItemId]);

	const hasDirtyItems = useMemo(() => items.some((i) => i.dirty), [items]);

	/** Only gallery-backed items survive a reload. */
	const restorableItemIds = useMemo(
		() => items.filter((i) => i.galleryImageId !== null && !i.dirty).map((i) => i.galleryImageId as string),
		[items],
	);

	// -------------------------------------------------------------------------
	// Adjustments (per active item, with per-item history)
	// -------------------------------------------------------------------------

	const resetControls = useCallback(() => {
		stopTimer();
		setGlobalState((prev) => ({ ...prev, counter: 0, counterRunning: false, counterDuration: null }));
		setItems((prev) =>
			updateActive(prev, activeItemId, (item) => ({
				...item,
				...createAdjustments(),
				history: [],
				future: [],
			})),
		);
	}, [activeItemId, stopTimer]);

	const applyAdjustment = useCallback(
		(change: Partial<AdjustmentSnapshot>) => {
			setItems((prev) =>
				updateActive(prev, activeItemId, (item) => ({
					...item,
					...change,
					history: pushHistory(item.history, snapshotOf(item)),
					future: [],
					dirty: true,
				})),
			);
		},
		[activeItemId],
	);

	const setBlur = useCallback((value: number) => applyAdjustment({ blur: value }), [applyAdjustment]);
	const setThreshold = useCallback((value: number) => applyAdjustment({ threshold: value }), [applyAdjustment]);
	const setValues = useCallback((value: 2 | 3) => applyAdjustment({ values: value }), [applyAdjustment]);

	const toggleShowOriginal = useCallback(() => {
		setItems((prev) => updateActive(prev, activeItemId, (item) => ({ ...item, showOriginal: !item.showOriginal })));
	}, [activeItemId]);

	// Apply a preset as a single undo entry
	const applyPreset = useCallback(
		(preset: { blur: number; threshold: number; values: 2 | 3 }) => {
			applyAdjustment({ blur: preset.blur, threshold: preset.threshold, values: preset.values });
		},
		[applyAdjustment],
	);

	const undo = useCallback(() => {
		setItems((prev) =>
			updateActive(prev, activeItemId, (item) => {
				if (item.history.length === 0) return item;
				const history = [...item.history];
				const snapshot = history.pop() as AdjustmentSnapshot;
				return {
					...item,
					blur: snapshot.blur,
					threshold: snapshot.threshold,
					values: snapshot.values,
					history,
					future: [...item.future, snapshotOf(item)],
				};
			}),
		);
	}, [activeItemId]);

	const redo = useCallback(() => {
		setItems((prev) =>
			updateActive(prev, activeItemId, (item) => {
				if (item.future.length === 0) return item;
				const future = [...item.future];
				const snapshot = future.pop() as AdjustmentSnapshot;
				return {
					...item,
					blur: snapshot.blur,
					threshold: snapshot.threshold,
					values: snapshot.values,
					history: pushHistory(item.history, snapshotOf(item)),
					future,
				};
			}),
		);
	}, [activeItemId]);

	// -------------------------------------------------------------------------
	// Panels
	// -------------------------------------------------------------------------

	const togglePanel = useCallback((panel: PanelId) => {
		setGlobalState((prev) => ({ ...prev, panels: { ...prev.panels, [panel]: !prev.panels[panel] } }));
	}, []);

	const setPanel = useCallback((panel: PanelId, open: boolean) => {
		setGlobalState((prev) => ({ ...prev, panels: { ...prev.panels, [panel]: open } }));
	}, []);

	// -------------------------------------------------------------------------
	// Zoom (global)
	// -------------------------------------------------------------------------

	const setZoom = useCallback((value: number) => {
		const clamped = Math.min(UI.ZOOM.MAX, Math.max(UI.ZOOM.MIN, value));
		setGlobalState((prev) => ({ ...prev, zoom: clamped, fitMode: 'manual' }));
	}, []);

	const setFitMode = useCallback((mode: FitMode) => {
		setGlobalState((prev) => ({ ...prev, fitMode: mode }));
	}, []);

	const zoomIn = useCallback(() => {
		setGlobalState((prev) => {
			const base = prev.fitMode === 'fit' ? prev.fitScale : prev.zoom;
			const next = Math.min(UI.ZOOM.MAX, Math.round((base + UI.ZOOM.STEP) * 100) / 100);
			return { ...prev, zoom: next, fitMode: 'manual' };
		});
	}, []);

	const zoomOut = useCallback(() => {
		setGlobalState((prev) => {
			const base = prev.fitMode === 'fit' ? prev.fitScale : prev.zoom;
			const next = Math.max(UI.ZOOM.MIN, Math.round((base - UI.ZOOM.STEP) * 100) / 100);
			return { ...prev, zoom: next, fitMode: 'manual' };
		});
	}, []);

	const setFitScale = useCallback((scale: number) => {
		setGlobalState((prev) => ({ ...prev, fitScale: scale }));
	}, []);

	// Reported by Canvas.tsx on stage resize. Bails out when unchanged so a
	// measurement round-trip can't drive a render loop.
	const setViewport = useCallback((next: Viewport) => {
		setGlobalState((prev) => {
			if (prev.viewport.width === next.width && prev.viewport.height === next.height) return prev;
			return { ...prev, viewport: next };
		});
	}, []);

	// -------------------------------------------------------------------------
	// Counter (global)
	// -------------------------------------------------------------------------

	const startCounter = useCallback((duration: number) => {
		if (timerRef.current) clearInterval(timerRef.current);
		setGlobalState((prev) => ({
			...prev,
			counter: duration,
			counterRunning: true,
			counterDuration: duration,
		}));
		timerRef.current = setInterval(() => {
			setGlobalState((prev) => {
				const next = prev.counter - 1;
				if (next <= 0) {
					if (timerRef.current) clearInterval(timerRef.current);
					timerRef.current = null;
					return { ...prev, counter: 0, counterRunning: false };
				}
				return { ...prev, counter: next };
			});
		}, 1000);
	}, []);

	const stopCounter = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		setGlobalState((prev) => ({ ...prev, counterRunning: false }));
	}, []);

	// -------------------------------------------------------------------------
	// Derived values
	// -------------------------------------------------------------------------

	const adjustments = activeItem ?? {
		blur: 0,
		threshold: 0,
		values: 2 as const,
		showOriginal: false,
		history: [] as AdjustmentSnapshot[],
		future: [] as AdjustmentSnapshot[],
	};

	const blankSize =
		activeItem?.kind === 'blank' && globalState.viewport.width > 0 && globalState.viewport.height > 0
			? { width: Math.round(globalState.viewport.width), height: Math.round(globalState.viewport.height) }
			: null;

	return {
		// Active item, projected onto the legacy single-document shape
		// (currentImage and originalImage are the same immutable object).
		currentImage: sourceImage,
		originalImage: sourceImage,
		fileName: activeItem?.fileName ?? '',
		hasImage: !!sourceImage,

		canvasMode,
		viewport: globalState.viewport,
		activeItemId,
		hasBlankCanvas: canvasMode === 'blank',
		hasCanvas: activeItem !== null,
		blankCanvasId: activeItemId,
		newBlankCanvas,
		setViewport,

		// Open items
		items,
		openItems: items,
		activateItem,
		closeItem,
		hasDirtyItems,
		restorableItemIds,
		markActiveSaved,
		markActiveDirty,
		linkGalleryImage,
		strokesByItemRef,

		// Actions
		loadImage,
		resetImage,
		resetControls,

		// Values study adjustments (per item)
		blur: adjustments.blur,
		threshold: adjustments.threshold,
		values: adjustments.values,
		showOriginal: adjustments.showOriginal,
		setBlur,
		setThreshold,
		setValues,
		toggleShowOriginal,

		// Presets
		applyPreset,

		// Undo/Redo (per item)
		undo,
		redo,
		canUndo: adjustments.history.length > 0,
		canRedo: adjustments.future.length > 0,

		// Panel visibility
		panels: globalState.panels,
		togglePanel,
		setPanel,

		// Zoom
		zoom: globalState.zoom,
		fitMode: globalState.fitMode,
		fitScale: globalState.fitScale,
		effectiveZoom: globalState.fitMode === 'fit' ? globalState.fitScale : globalState.zoom,
		setZoom,
		setFitMode,
		setFitScale,
		zoomIn,
		zoomOut,

		// Counter
		counter: globalState.counter,
		counterRunning: globalState.counterRunning,
		counterDuration: globalState.counterDuration,
		startCounter,
		stopCounter,

		// Blank canvas dimensions for the status bar
		blankSize,
	};
};

export type ImageContextValue = ReturnType<typeof useImage>;
