import { useMemo, useSyncExternalStore } from 'react';
import { EditorStore } from '../core/EditorStore';

/**
 * React binding for {@link EditorStore}.
 *
 * Kept only so the existing Context wiring keeps working during the migration;
 * Phase 4 replaces it with a field-level `useStore` selector binding.
 *
 * This still re-renders every consumer on any change, because the whole
 * snapshot is one context value. That is deliberately behaviour-preserving for
 * now — fixing it is what Phase 4 is for.
 */
export const useImage = () => {
	const store = useMemo(() => new EditorStore(), []);
	// Subscribe to the whole snapshot so the wrapper re-renders on any change.
	const state = useSyncExternalStore(store.subscribe, store.getState);
	// Must stay referentially stable: Canvas has it in useCallback deps.
	const strokesByItemRef = useMemo(() => ({ current: store.strokesByItem }), [store]);
	const activeItem = state.items.find((i) => i.id === state.activeItemId) ?? null;

	return {
		// Active item, projected onto the legacy single-document shape
		// (currentImage and originalImage are the same immutable object).
		currentImage: activeItem?.image ?? null,
		originalImage: activeItem?.image ?? null,
		fileName: activeItem?.fileName ?? '',
		hasImage: activeItem?.image != null,

		canvasMode: activeItem?.kind ?? ('image' as const),
		viewport: state.viewport,
		activeItemId: state.activeItemId,
		hasBlankCanvas: activeItem?.kind === 'blank',
		hasCanvas: activeItem !== null,
		blankCanvasId: state.activeItemId,
		newBlankCanvas: store.newBlankCanvas,
		setViewport: store.setViewport,

		// Open items
		items: state.items,
		openItems: state.items,
		activateItem: store.activateItem,
		closeItem: store.closeItem,
		hasDirtyItems: store.hasDirtyItems,
		restorableItemIds: store.restorableItemIds,
		markActiveSaved: store.markActiveSaved,
		markActiveDirty: store.markActiveDirty,
		linkGalleryImage: store.linkGalleryImage,
		strokesByItemRef,

		// Actions
		loadImage: store.loadImage,
		resetImage: store.resetImage,
		resetControls: store.resetControls,

		// Values study adjustments (per item)
		blur: activeItem?.blur ?? 0,
		threshold: activeItem?.threshold ?? 0,
		values: activeItem?.values ?? 2,
		showOriginal: activeItem?.showOriginal ?? false,
		setBlur: store.setBlur,
		setThreshold: store.setThreshold,
		setValues: store.setValues,
		toggleShowOriginal: store.toggleShowOriginal,

		// Presets
		applyPreset: store.applyPreset,

		// Undo/Redo (per item)
		undo: store.undo,
		redo: store.redo,
		canUndo: (activeItem?.history.length ?? 0) > 0,
		canRedo: (activeItem?.future.length ?? 0) > 0,

		// Panel visibility
		panels: state.panels,
		togglePanel: store.togglePanel,
		setPanel: store.setPanel,

		// Zoom
		zoom: state.zoom,
		fitMode: state.fitMode,
		fitScale: state.fitScale,
		effectiveZoom: state.fitMode === 'fit' ? state.fitScale : state.zoom,
		setZoom: store.setZoom,
		setFitMode: store.setFitMode,
		setFitScale: store.setFitScale,
		zoomIn: store.zoomIn,
		zoomOut: store.zoomOut,

		// Counter
		counter: state.counter,
		counterRunning: state.counterRunning,
		counterDuration: state.counterDuration,
		startCounter: store.startCounter,
		stopCounter: store.stopCounter,

		// Blank canvas dimensions for the status bar
		blankSize: store.blankSize,
	};
};

export type { OpenImageMeta, OpenItem, Stroke } from '../core/types';

export type ImageContextValue = ReturnType<typeof useImage>;
