import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI } from '../constants/ui';
import {
	selectActiveImage,
	selectBlur,
	selectIsBlank,
	selectShowOriginal,
	selectThreshold,
	selectValues,
} from '../core/selectors';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useEditorStore, useEditorSelector } from '../react/useStore';
import { useImageProcessingWorker } from '../hooks/useImageProcessingWorker';
import { imageToImageData } from '../utils/imageConversion';
import { Icon } from './shared/Icon';

interface CanvasProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/** Flat [x0, y0, x1, y1, ...] with coordinates normalized to 0..1. */
type Stroke = number[];

function applyBrushStyle(ctx: CanvasRenderingContext2D) {
	ctx.strokeStyle = UI.CANVAS.BRUSH_COLOR;
	ctx.lineWidth = UI.CANVAS.BRUSH_SIZE;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number) {
	if (stroke.length === 0) return;
	// A tap with no drag has no segment — draw it as a dot instead.
	if (stroke.length < 4) {
		ctx.beginPath();
		ctx.arc(stroke[0] * width, stroke[1] * height, UI.CANVAS.BRUSH_SIZE / 2, 0, Math.PI * 2);
		ctx.fillStyle = UI.CANVAS.BRUSH_COLOR;
		ctx.fill();
		return;
	}
	applyBrushStyle(ctx);
	ctx.beginPath();
	ctx.moveTo(stroke[0] * width, stroke[1] * height);
	for (let i = 2; i < stroke.length; i += 2) {
		ctx.lineTo(stroke[i] * width, stroke[i + 1] * height);
	}
	ctx.stroke();
}

const Canvas: React.FC<CanvasProps> = ({ previewCanvasRef }) => {
	// Non-reactive members: stable for the app's lifetime, so they never appear
	// in a selector (notably `strokesByItem`, which must not trigger re-renders).
	const editor = useEditorStore();
	const { strokesByItem, setZoom, setFitScale, setViewport, markActiveDirty } = editor;

	// Reactive slices. Only these re-render this component.
	const activeItemId = useEditorSelector((s) => s.activeItemId);
	const blur = useEditorSelector(selectBlur);
	const threshold = useEditorSelector(selectThreshold);
	const values = useEditorSelector(selectValues);
	const showOriginal = useEditorSelector(selectShowOriginal);
	const currentImage = useEditorSelector(selectActiveImage);
	const zoom = useEditorSelector((s) => s.zoom);
	const fitMode = useEditorSelector((s) => s.fitMode);

	// A blank canvas is a drawing surface and bypasses the filter worker entirely.
	const isBlank = useEditorSelector(selectIsBlank);

	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [displayImageData, setDisplayImageData] = useState<ImageData | null>(null);
	const cancelProcessRef = useRef<(() => void) | null>(null);

	// Strokes live in the store's mutable map keyed by item id — never in this
	// component's state — so painting never re-renders the tree and switching
	// items restores the correct drawing without copying anything.
	const drawingRef = useRef<Stroke | null>(null);

	const strokesFor = useCallback((): Stroke[] | null => {
		if (!isBlank || activeItemId === null) return null;
		return editor.getStrokes(activeItemId);
	}, [isBlank, activeItemId, editor]);

	const { process } = useImageProcessingWorker();

	// Memoize the original (unprocessed) ImageData so toggling showOriginal
	// doesn't create a new object every render and cause an infinite loop.
	const originalImageData = useMemo(() => (currentImage ? imageToImageData(currentImage) : null), [currentImage]);

	// Debounced full-resolution settle
	const settleFullRes = useDebouncedCallback(
		useCallback(
			(b: number, t: number, v: 2 | 3) => {
				if (!currentImage || showOriginal) return;
				// Cancel any ongoing preview job
				cancelProcessRef.current?.();
				cancelProcessRef.current = process(
					currentImage,
					{ blur: b, threshold: t, values: v },
					false, // full-res
					(result) => {
						if (result.ok) {
							setDisplayImageData(result.imageData);
						}
					},
				);
			},
			[currentImage, process, showOriginal],
		),
		UI.PERF.INTERACTIVE_DEBOUNCE_MS,
	);

	// When params change: fire interactive (preview) pass immediately,
	// then schedule a full-res settle after debounce.
	useEffect(() => {
		if (isBlank || !currentImage || showOriginal) return;

		// Cancel any in-flight job
		cancelProcessRef.current?.();

		const pixels = currentImage.width * currentImage.height;
		const needsPreview = pixels > UI.PERF.PREVIEW_MAX_PIXELS;

		if (needsPreview) {
			// Fast: preview pass (downscaled)
			cancelProcessRef.current = process(
				currentImage,
				{ blur, threshold, values },
				true, // preview
				(result) => {
					if (result.ok) {
						setDisplayImageData(result.imageData);
					}
				},
			);
			// Slow: schedule full-res after debounce
			settleFullRes.call(blur, threshold, values);
		} else {
			// Image is small enough — go straight to full-res (no preview needed)
			cancelProcessRef.current = process(
				currentImage,
				{ blur, threshold, values },
				false, // full-res
				(result) => {
					if (result.ok) {
						setDisplayImageData(result.imageData);
					}
				},
			);
			settleFullRes.cancel();
		}

		return () => {
			settleFullRes.cancel();
		};
	}, [currentImage, blur, threshold, values, showOriginal, process, settleFullRes, isBlank]);

	// When showOriginal toggles, render the source image directly.
	// Uses memoized originalImageData to avoid creating a new ImageData each
	// render, which previously caused an infinite re-render loop.
	useEffect(() => {
		if (isBlank || !currentImage) return;
		if (showOriginal) {
			settleFullRes.cancel();
			cancelProcessRef.current?.();
			cancelProcessRef.current = null;
			if (originalImageData) {
				setDisplayImageData(originalImageData);
			}
		}
	}, [currentImage, showOriginal, originalImageData, settleFullRes, isBlank]);

	// When image changes: clear canvas backing store first (memory hygiene).
	// A blank canvas also has no currentImage but owns the backing store, so it
	// must be excluded here.
	useEffect(() => {
		const canvas = previewCanvasRef.current;
		if (!canvas) return;
		if (!currentImage && !isBlank) {
			// Clear canvas
			canvas.width = 0;
			canvas.height = 0;
		}
	}, [currentImage, isBlank, previewCanvasRef]);

	// Draw displayImageData onto the canvas
	useEffect(() => {
		if (isBlank) return;
		if (!displayImageData || !previewCanvasRef.current) return;
		const canvas = previewCanvasRef.current;
		canvas.width = displayImageData.width;
		canvas.height = displayImageData.height;
		const ctx = canvas.getContext('2d');
		ctx?.putImageData(displayImageData, 0, 0);
	}, [displayImageData, previewCanvasRef, isBlank]);

	// Track container size with ResizeObserver
	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver(([entry]) => {
			setContainerSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			});
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	const redrawBlank = useCallback(() => {
		const canvas = previewCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.fillStyle = UI.CANVAS.BACKGROUND;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		for (const stroke of strokesByItem.get(activeItemId ?? '') ?? []) {
			paintStroke(ctx, stroke, canvas.width, canvas.height);
		}
	}, [previewCanvasRef, strokesByItem, activeItemId]);

	// Map a pointer event into 0..1 space over the canvas' rendered box.
	const toNormalized = useCallback((e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
		const rect = e.currentTarget.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return [0, 0];
		return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
	}, []);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			if (!isBlank || e.button !== 0) return;
			e.preventDefault();
			e.currentTarget.setPointerCapture(e.pointerId);
			drawingRef.current = [...toNormalized(e)];
		},
		[isBlank, toNormalized],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			const stroke = drawingRef.current;
			if (!isBlank || !stroke) return;
			const canvas = previewCanvasRef.current;
			const ctx = canvas?.getContext('2d');
			if (!ctx || !canvas) return;

			const fromX = stroke[stroke.length - 2] * canvas.width;
			const fromY = stroke[stroke.length - 1] * canvas.height;
			const [nx, ny] = toNormalized(e);
			stroke.push(nx, ny);

			// Paint only the new segment; a full redraw per move would be O(n²).
			applyBrushStyle(ctx);
			ctx.beginPath();
			ctx.moveTo(fromX, fromY);
			ctx.lineTo(nx * canvas.width, ny * canvas.height);
			ctx.stroke();
		},
		[isBlank, previewCanvasRef, toNormalized],
	);

	const endStroke = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			const stroke = drawingRef.current;
			if (!stroke) return;
			drawingRef.current = null;
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
			strokesFor()?.push(stroke);
			// Unsaved changes: this is the one point per stroke where a re-render
			// is acceptable (the beforeunload guard and list badges read `dirty`).
			markActiveDirty();

			// A tap produced no segment during move, so paint the dot now.
			if (stroke.length < 4) {
				const canvas = previewCanvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (ctx && canvas) paintStroke(ctx, stroke, canvas.width, canvas.height);
			}
		},
		[previewCanvasRef, strokesFor, markActiveDirty],
	);

	// Report stage size up so the bottom bar can read dimensions and a blank
	// canvas knows how big to be.
	useEffect(() => {
		setViewport({ width: containerSize.width, height: containerSize.height });
	}, [containerSize, setViewport]);

	// Drop stale worker output on entering blank mode, so a later re-render
	// can't blit image pixels over the drawing surface.
	useEffect(() => {
		if (isBlank) setDisplayImageData(null);
	}, [isBlank]);

	// Size the backing store to the stage and repaint. Strokes are normalized,
	// so a window resize rescales them instead of smearing. Re-running on
	// activeItemId is what swaps in the drawing of a newly activated canvas.
	useEffect(() => {
		if (!isBlank || activeItemId === null) return;
		const canvas = previewCanvasRef.current;
		if (!canvas) return;

		const width = Math.max(UI.CANVAS.MIN_SIZE, containerSize.width);
		const height = Math.max(UI.CANVAS.MIN_SIZE, containerSize.height);
		// Assigning width/height resets the backing store, so always repaint after.
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}

		redrawBlank();
	}, [isBlank, activeItemId, containerSize, redrawBlank, previewCanvasRef]);

	// Compute fit scale (never upscale beyond 100%)
	const fitScale = useMemo(() => {
		if (!currentImage || containerSize.width === 0 || containerSize.height === 0) return 1;
		const padding = 48;
		const availW = containerSize.width - padding;
		const availH = containerSize.height - padding;
		return Math.min(availW / currentImage.width, availH / currentImage.height, UI.ZOOM.FIT_MAX);
	}, [currentImage, containerSize]);

	const effectiveZoom = fitMode === 'fit' ? fitScale : zoom;

	// Report fitScale so other components can read it as reactive state.
	useEffect(() => {
		setFitScale(fitScale);
	}, [fitScale, setFitScale]);

	// Ctrl+wheel handler
	const handleWheel = useCallback(
		(e: WheelEvent) => {
			if (!e.ctrlKey && !e.metaKey) return;
			e.preventDefault();
			const delta = e.deltaY > 0 ? -UI.ZOOM.WHEEL_STEP : UI.ZOOM.WHEEL_STEP;
			const currentEffective = fitMode === 'fit' ? fitScale : zoom;
			// Round to avoid floating-point drift from repeated wheel events
			setZoom(Math.round((currentEffective + delta) * 100) / 100);
		},
		[fitMode, fitScale, zoom, setZoom],
	);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		el.addEventListener('wheel', handleWheel, { passive: false });
		return () => el.removeEventListener('wheel', handleWheel);
	}, [handleWheel]);

	// Display dimensions: use processed size if available (may be preview-scaled),
	// but layout is always based on source dimensions.
	const canvasWidth = currentImage?.width ?? 0;
	const canvasHeight = currentImage?.height ?? 0;
	const scaledWidth = canvasWidth * effectiveZoom;
	const scaledHeight = canvasHeight * effectiveZoom;

	const isEmpty = !isBlank && !currentImage;

	return (
		<div className='flex-1 p-3 overflow-hidden'>
			<div ref={containerRef} className='bg-white rounded-2xl shadow-lg w-full h-full overflow-auto'>
				{isEmpty ? (
					<div className='w-full h-full flex items-center justify-center'>
						<div className='text-center'>
							<div className='w-24 h-24 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center'>
								<Icon name='image' size='lg' className='text-slate-400' strokeWidth={1.5} />
							</div>
							<p className='text-lg font-medium text-slate-600'>No image loaded</p>
							<p className='text-sm text-slate-500 mt-1'>Click "New" or "Open" to get started</p>
						</div>
					</div>
				) : (
					// Blank mode fills the stage exactly (backing store == CSS px, so
					// pointer coords map 1:1); image mode zooms and centers instead.
					<div
						className={isBlank ? 'w-full h-full' : 'flex items-center justify-center'}
						style={isBlank ? undefined : { minWidth: '100%', minHeight: '100%', padding: 24 }}
					>
						<canvas
							ref={previewCanvasRef}
							className={isBlank ? 'block touch-none cursor-crosshair' : 'block'}
							style={
								isBlank
									? { width: '100%', height: '100%' }
									: { width: scaledWidth, height: scaledHeight, imageRendering: 'pixelated' }
							}
							onPointerDown={handlePointerDown}
							onPointerMove={handlePointerMove}
							onPointerUp={endStroke}
							onPointerCancel={endStroke}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

export default Canvas;
