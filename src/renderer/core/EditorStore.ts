import { UI } from '../constants/ui';
import type {
	AdjustmentSnapshot,
	CanvasMode,
	EditorState,
	FitMode,
	Listener,
	OpenImageMeta,
	OpenItem,
	PanelId,
	Stroke,
	Viewport,
} from './types';
import type { Image } from 'image-js';

const DEFAULT_PANELS: Record<PanelId, boolean> = {
	controls: true,
	original: true,
	timer: true,
	gallery: false,
};

const COUNTER_TICK_MS = 1000;

function createInitialState(): EditorState {
	return {
		items: [],
		activeItemId: null,
		viewport: { width: 0, height: 0 },
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

/**
 * Editor state as an external store.
 *
 * Framework-free by design: no React, so it can be unit-tested directly and
 * reused from a worker or a command. Consumers call `getState()` and
 * `subscribe()`; React binds to that pair via `useSyncExternalStore`.
 *
 * Two invariants this class exists to protect:
 *
 * 1. **Strokes are never in state.** They live in a private Map keyed by item
 *    id, because painting must not notify subscribers and keying by id makes
 *    switching items restore the right drawing for free.
 * 2. **`getState()` is referentially stable between mutations.** Every mutator
 *    must return the *same* state object when nothing actually changed, or
 *    `useSyncExternalStore` will loop forever.
 */
export class EditorStore {
	#state: EditorState = createInitialState();
	#listeners = new Set<Listener>();

	#strokes = new Map<string, Stroke[]>();
	#idCounter = 0;
	#timer: ReturnType<typeof setInterval> | null = null;

	// -------------------------------------------------------------------------
	// Store plumbing
	// -------------------------------------------------------------------------

	getState = (): EditorState => this.#state;

	/** Bound as an arrow property so the identity is stable across renders. */
	subscribe = (listener: Listener): (() => void) => {
		this.#listeners.add(listener);
		return () => {
			this.#listeners.delete(listener);
		};
	};

	/** Releases the timer and drops all subscribers. */
	dispose(): void {
		this.#clearTimer();
		this.#listeners.clear();
		this.#strokes.clear();
	}

	/**
	 * Single mutation funnel. `fn` must return the *identical* state object when
	 * the update is a no-op, so no-ops neither notify nor break snapshot
	 * stability.
	 */
	#patch(fn: (state: EditorState) => EditorState): void {
		const next = fn(this.#state);
		if (next === this.#state) return;
		this.#state = next;
		for (const listener of [...this.#listeners]) listener();
	}

	#nextItemId(): string {
		return `item-${++this.#idCounter}`;
	}

	// -------------------------------------------------------------------------
	// Strokes (deliberately outside observable state)
	// -------------------------------------------------------------------------

	/** Returns the item's strokes, creating the list on first use. */
	getStrokes(itemId: string): Stroke[] {
		let list = this.#strokes.get(itemId);
		if (!list) {
			list = [];
			this.#strokes.set(itemId, list);
		}
		return list;
	}

	/** The live stroke map. Never include this in a React snapshot or selector. */
	get strokesByItem(): Map<string, Stroke[]> {
		return this.#strokes;
	}

	// -------------------------------------------------------------------------
	// Derived values
	// -------------------------------------------------------------------------

	#activeItem(): OpenItem | null {
		const { items, activeItemId } = this.#state;
		if (activeItemId === null) return null;
		return items.find((i) => i.id === activeItemId) ?? null;
	}

	get activeItem(): OpenItem | null {
		return this.#activeItem();
	}

	get canvasMode(): CanvasMode {
		return this.#activeItem()?.kind ?? 'image';
	}

	/** currentImage and originalImage are the same immutable object. */
	get currentImage(): Image | null {
		return this.#activeItem()?.image ?? null;
	}

	get fileName(): string {
		return this.#activeItem()?.fileName ?? '';
	}

	get hasImage(): boolean {
		return this.#activeItem()?.image != null;
	}

	get hasBlankCanvas(): boolean {
		return this.canvasMode === 'blank';
	}

	get hasCanvas(): boolean {
		return this.#activeItem() !== null;
	}

	get hasDirtyItems(): boolean {
		return this.#state.items.some((i) => i.dirty);
	}

	/** Only gallery-backed, non-dirty items survive a reload. */
	get restorableItemIds(): string[] {
		return this.#state.items
			.filter((i) => i.galleryImageId !== null && !i.dirty)
			.map((i) => i.galleryImageId as string);
	}

	get canUndo(): boolean {
		return (this.#activeItem()?.history.length ?? 0) > 0;
	}

	get canRedo(): boolean {
		return (this.#activeItem()?.future.length ?? 0) > 0;
	}

	get effectiveZoom(): number {
		return this.#state.fitMode === 'fit' ? this.#state.fitScale : this.#state.zoom;
	}

	/** Blank-canvas dimensions for the status bar; null for images or before layout. */
	get blankSize(): { width: number; height: number } | null {
		const item = this.#activeItem();
		const { viewport } = this.#state;
		if (item?.kind !== 'blank' || viewport.width <= 0 || viewport.height <= 0) return null;
		return { width: Math.round(viewport.width), height: Math.round(viewport.height) };
	}

	// -------------------------------------------------------------------------
	// Timer internals
	// -------------------------------------------------------------------------

	#clearTimer(): void {
		if (this.#timer !== null) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
	}

	/** Clears the interval and marks the counter stopped. */
	stopTimer = (): void => {
		this.#clearTimer();
		this.#patch((s) => (s.counterRunning ? { ...s, counterRunning: false } : s));
	};

	/**
	 * Zoom is app-global, so reset to fit whenever the active document changes —
	 * a newly opened or activated item must never inherit another's zoom.
	 */
	#resetZoomToFit = (s: EditorState): EditorState =>
		s.zoom === 1 && s.fitMode === 'fit' ? s : { ...s, zoom: 1, fitMode: 'fit' };

	// -------------------------------------------------------------------------
	// Opening and closing items
	// -------------------------------------------------------------------------

	/**
	 * Opens a photo as an item and activates it. A `dedupeKey` (or gallery id)
	 * reactivates an already-open item instead of duplicating it — unless that
	 * item has unsaved changes, which must never be silently merged away.
	 */
	loadImage = async (image: Image, fileName = '', meta: OpenImageMeta = {}): Promise<void> => {
		this.stopTimer();
		const key = meta.dedupeKey ?? meta.galleryImageId ?? null;

		this.#patch((s) => {
			const existing = key === null ? undefined : s.items.find((i) => i.dedupeKey === key && !i.dirty);
			if (existing) return { ...this.#resetZoomToFit(s), activeItemId: existing.id };

			const item: OpenItem = {
				id: this.#nextItemId(),
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
			return {
				...this.#resetZoomToFit(s),
				items: [...s.items, item],
				activeItemId: item.id,
			};
		});
	};

	/** New blank canvas. Each call creates a distinct item so canvases stack in the list. */
	newBlankCanvas = (): void => {
		this.stopTimer();
		this.#patch((s) => {
			const blankCount = s.items.filter((i) => i.kind === 'blank').length;
			const item: OpenItem = {
				id: this.#nextItemId(),
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
			return {
				...this.#resetZoomToFit(s),
				items: [...s.items, item],
				activeItemId: item.id,
			};
		});
	};

	/** Switches the active item, preserving every item's own state and drawing. */
	activateItem = (id: string): void => {
		this.#patch((s) => (s.activeItemId === id ? s : { ...this.#resetZoomToFit(s), activeItemId: id }));
	};

	/** Closes an item and drops its strokes. Returns it so callers can confirm first. */
	closeItem = (id: string): OpenItem | null => {
		const closing = this.#state.items.find((i) => i.id === id) ?? null;
		if (!closing) return null;

		this.#strokes.delete(id);
		this.#patch((s) => {
			const remaining = s.items.filter((i) => i.id !== id);
			const activeItemId = s.activeItemId !== id ? s.activeItemId : (remaining[remaining.length - 1]?.id ?? null);
			return { ...s, items: remaining, activeItemId };
		});
		return closing;
	};

	/** Close everything. */
	resetImage = (): void => {
		this.stopTimer();
		this.#strokes.clear();
		this.#patch((s) => ({ ...this.#resetZoomToFit(s), items: [], activeItemId: null }));
	};

	// -------------------------------------------------------------------------
	// Saving / dirty tracking
	// -------------------------------------------------------------------------

	/** Marks the active item clean — called after a successful Save. */
	markActiveSaved = (): void => {
		this.#patch((s) => {
			if (s.activeItemId === null) return s;
			const active = s.items.find((i) => i.id === s.activeItemId);
			if (!active?.dirty) return s;
			return {
				...s,
				items: s.items.map((i) => (i.id === s.activeItemId ? { ...i, dirty: false } : i)),
			};
		});
	};

	/** Links an item to its gallery entry, making it restorable after a reload. */
	linkGalleryImage = (itemId: string, galleryImageId: string, thumbUrl?: string | null): void => {
		this.#patch((s) => ({
			...s,
			items: s.items.map((i) =>
				i.id === itemId ? { ...i, galleryImageId, thumbUrl: thumbUrl ?? i.thumbUrl, dedupeKey: galleryImageId } : i,
			),
		}));
	};

	/** Flags the active item as having unsaved changes (after a stroke is committed). */
	markActiveDirty = (): void => {
		this.#patch((s) => ({
			...s,
			items: s.items.map((i) =>
				s.activeItemId !== null && i.id === s.activeItemId && !i.dirty ? { ...i, dirty: true } : i,
			),
		}));
	};

	// -------------------------------------------------------------------------
	// Adjustments (per active item, with per-item history)
	// -------------------------------------------------------------------------

	/** Reset controls: adjustments, undo history and the timer. Keeps the item open. */
	resetControls = (): void => {
		this.stopTimer();
		this.#patch((s) => ({
			...s,
			counter: 0,
			counterDuration: null,
			items: updateActive(s.items, s.activeItemId, (item) => ({
				...item,
				...createAdjustments(),
				history: [],
				future: [],
			})),
		}));
	};

	#applyAdjustment(change: Partial<AdjustmentSnapshot>): void {
		this.#patch((s) => ({
			...s,
			items: updateActive(s.items, s.activeItemId, (item) => ({
				...item,
				...change,
				history: pushHistory(item.history, snapshotOf(item)),
				future: [],
				dirty: true,
			})),
		}));
	}

	setBlur = (value: number): void => this.#applyAdjustment({ blur: value });
	setThreshold = (value: number): void => this.#applyAdjustment({ threshold: value });
	setValues = (value: 2 | 3): void => this.#applyAdjustment({ values: value });

	toggleShowOriginal = (): void => {
		this.#patch((s) => ({
			...s,
			items: updateActive(s.items, s.activeItemId, (item) => ({ ...item, showOriginal: !item.showOriginal })),
		}));
	};

	/** Apply a preset as a single undo entry. */
	applyPreset = (preset: AdjustmentSnapshot): void => this.#applyAdjustment(preset);

	undo = (): void => {
		this.#patch((s) => ({
			...s,
			items: updateActive(s.items, s.activeItemId, (item) => {
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
		}));
	};

	redo = (): void => {
		this.#patch((s) => ({
			...s,
			items: updateActive(s.items, s.activeItemId, (item) => {
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
		}));
	};

	// -------------------------------------------------------------------------
	// Panels
	// -------------------------------------------------------------------------

	togglePanel = (panel: PanelId): void => {
		this.#patch((s) => ({ ...s, panels: { ...s.panels, [panel]: !s.panels[panel] } }));
	};

	setPanel = (panel: PanelId, open: boolean): void => {
		this.#patch((s) => (s.panels[panel] === open ? s : { ...s, panels: { ...s.panels, [panel]: open } }));
	};

	// -------------------------------------------------------------------------
	// Zoom (app-global)
	// -------------------------------------------------------------------------

	setZoom = (value: number): void => {
		const clamped = Math.min(UI.ZOOM.MAX, Math.max(UI.ZOOM.MIN, value));
		this.#patch((s) => ({ ...s, zoom: clamped, fitMode: 'manual' }));
	};

	setFitMode = (mode: FitMode): void => {
		this.#patch((s) => (s.fitMode === mode ? s : { ...s, fitMode: mode }));
	};

	#stepZoom(direction: 1 | -1): void {
		this.#patch((s) => {
			const base = s.fitMode === 'fit' ? s.fitScale : s.zoom;
			const raw = Math.round((base + direction * UI.ZOOM.STEP) * 100) / 100;
			const next = direction === 1 ? Math.min(UI.ZOOM.MAX, raw) : Math.max(UI.ZOOM.MIN, raw);
			return next === s.zoom ? s : { ...s, zoom: next, fitMode: 'manual' };
		});
	}

	zoomIn = (): void => this.#stepZoom(1);
	zoomOut = (): void => this.#stepZoom(-1);

	/** Reported by Canvas.tsx once per layout pass. */
	setFitScale = (scale: number): void => {
		this.#patch((s) => (s.fitScale === scale ? s : { ...s, fitScale: scale }));
	};

	/**
	 * Reported by Canvas.tsx on stage resize. No-ops when unchanged so the
	 * measurement round-trip can't drive a render loop.
	 */
	setViewport = (next: Viewport): void => {
		this.#patch((s) =>
			s.viewport.width === next.width && s.viewport.height === next.height ? s : { ...s, viewport: next },
		);
	};

	// -------------------------------------------------------------------------
	// Counter (app-global)
	// -------------------------------------------------------------------------

	startCounter = (duration: number): void => {
		this.#clearTimer();
		this.#patch((s) => ({ ...s, counter: duration, counterRunning: true, counterDuration: duration }));

		this.#timer = setInterval(() => {
			let finished = false;
			this.#patch((s) => {
				const next = s.counter - 1;
				if (next <= 0) {
					finished = true;
					return { ...s, counter: 0, counterRunning: false };
				}
				return { ...s, counter: next };
			});
			if (finished) this.#clearTimer();
		}, COUNTER_TICK_MS);
	};

	stopCounter = (): void => {
		this.#clearTimer();
		this.#patch((s) => (s.counterRunning ? { ...s, counterRunning: false } : s));
	};
}
