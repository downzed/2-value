import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI } from '../constants/ui';
import { useImageContext } from '../hooks/ImageContext';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useImageProcessingWorker } from '../hooks/useImageProcessingWorker';
import { Icon } from './shared/Icon';

interface CanvasProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const Canvas: React.FC<CanvasProps> = ({ previewCanvasRef }) => {
	const { currentImage, blur, threshold, values, showOriginal, zoom, fitMode, setZoom, effectiveZoomRef } =
		useImageContext();

	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [displayImageData, setDisplayImageData] = useState<ImageData | null>(null);
	const cancelProcessRef = useRef<(() => void) | null>(null);

	const { process } = useImageProcessingWorker();

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
		if (!currentImage || showOriginal) return;

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
	}, [currentImage, blur, threshold, values, showOriginal, process, settleFullRes]);

	// When showOriginal toggles, render the source image directly
	useEffect(() => {
		if (!currentImage) return;
		if (showOriginal) {
			settleFullRes.cancel();
			cancelProcessRef.current?.();
			cancelProcessRef.current = null;
			// Display source image unchanged using getRawImage() (no private .data access)
			const raw = currentImage.getRawImage();
			const clamped = new Uint8ClampedArray(raw.data.byteLength);
			for (let i = 0; i < raw.data.length; i++) clamped[i] = raw.data[i];
			const id = new ImageData(clamped as Uint8ClampedArray<ArrayBuffer>, raw.width, raw.height);
			setDisplayImageData(id);
		}
	}, [currentImage, showOriginal, settleFullRes]);

	// When image changes: clear canvas backing store first (memory hygiene)
	useEffect(() => {
		const canvas = previewCanvasRef.current;
		if (!canvas) return;
		if (!currentImage) {
			// Clear canvas
			canvas.width = 0;
			canvas.height = 0;
		}
	}, [currentImage, previewCanvasRef]);

	// Draw displayImageData onto the canvas
	useEffect(() => {
		if (!displayImageData || !previewCanvasRef.current) return;
		const canvas = previewCanvasRef.current;
		canvas.width = displayImageData.width;
		canvas.height = displayImageData.height;
		const ctx = canvas.getContext('2d');
		ctx?.putImageData(displayImageData, 0, 0);
	}, [displayImageData, previewCanvasRef]);

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

	// Compute fit scale (never upscale beyond 100%)
	const fitScale = useMemo(() => {
		if (!currentImage || containerSize.width === 0 || containerSize.height === 0) return 1;
		const padding = 48;
		const availW = containerSize.width - padding;
		const availH = containerSize.height - padding;
		return Math.min(availW / currentImage.width, availH / currentImage.height, UI.ZOOM.FIT_MAX);
	}, [currentImage, containerSize]);

	const effectiveZoom = fitMode === 'fit' ? fitScale : zoom;

	// Keep the shared ref in sync so zoomIn/zoomOut and BottomPanel
	// always know the true visual zoom level.
	effectiveZoomRef.current = effectiveZoom;

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

	return (
		<div className='flex-1 p-3 overflow-hidden'>
			<div ref={containerRef} className='bg-white rounded-2xl shadow-lg w-full h-full overflow-auto'>
				{!currentImage ? (
					<div className='w-full h-full flex items-center justify-center'>
						<div className='text-center'>
							<div className='w-24 h-24 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center'>
								<Icon name='image' size='lg' className='text-slate-400' strokeWidth={1.5} />
							</div>
							<p className='text-lg font-medium text-slate-600'>No image loaded</p>
							<p className='text-sm text-slate-500 mt-1'>Click "Open" to get started</p>
						</div>
					</div>
				) : (
					<div
						className='flex items-center justify-center'
						style={{ minWidth: '100%', minHeight: '100%', padding: 24 }}
					>
						<canvas
							ref={previewCanvasRef}
							className='block'
							style={{
								width: scaledWidth,
								height: scaledHeight,
								imageRendering: 'pixelated',
							}}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

export default Canvas;
