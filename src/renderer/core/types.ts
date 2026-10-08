import type { Image } from 'image-js';

export type PanelId = 'controls' | 'original' | 'timer' | 'gallery';

export type FitMode = 'fit' | 'manual';

export type CanvasMode = 'image' | 'blank';

export interface Viewport {
	width: number;
	height: number;
}

/** Flat [x0, y0, x1, y1, ...] with coordinates normalized to 0..1. Blank canvases only. */
export type Stroke = number[];

export interface AdjustmentSnapshot {
	blur: number;
	threshold: number;
	values: 2 | 3;
}

export interface OpenItem {
	id: string;
	/** 'image' flows through the filter worker; 'blank' bypasses it and is a drawing surface. */
	kind: CanvasMode;
	/** Row label in the gallery's Auto folder. */
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

export interface OpenImageMeta {
	/** Gallery entry backing this item. Presence makes the item restorable. */
	galleryImageId?: string | null;
	thumbUrl?: string | null;
	/** Identifies the already-open row to reactivate instead of adding a duplicate. */
	dedupeKey?: string | null;
}

/**
 * The whole observable state of the editor.
 *
 * Flattened on purpose: Phase 4 subscribes with field-level selectors, so a
 * shallow `s.zoom` / `s.panels` read is all a component should need.
 */
export interface EditorState {
	/** Open items, in creation order. */
	items: OpenItem[];
	/** Which item is projected onto the single-document view. */
	activeItemId: string | null;

	/** Measured stage size, reported by Canvas.tsx. */
	viewport: Viewport;

	/** Zoom is app-global, not per item; it resets to fit when the item changes. */
	zoom: number;
	fitMode: FitMode;
	fitScale: number;

	/** Countdown timer, app-global. */
	counter: number;
	counterRunning: boolean;
	counterDuration: number | null;

	panels: Record<PanelId, boolean>;
}

export type Listener = () => void;
