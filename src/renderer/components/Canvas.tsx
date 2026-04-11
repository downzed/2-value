import { type Image, writeCanvas } from 'image-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI } from '../constants/ui';
import { useImageContext } from '../hooks/ImageContext';
import { Icon } from './shared/Icon';

interface CanvasProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const Canvas: React.FC<CanvasProps> = ({ previewCanvasRef }) => {
	const { currentImage, blur, threshold, values, showOriginal, zoom, fitMode, setZoom } = useImageContext();

	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

	const processed = useMemo(() => {
		if (!currentImage) return null;
		let result: Image = currentImage.clone();
		try {
			if (threshold > 0 || values === 3) {
				result = result.grey({ algorithm: 'luma709' }) as unknown as Image;
			}
			if (blur > 0) {
				result = result.gaussianBlur({ sigma: blur }) as Image;
			}
			if (threshold > 0) {
				if (values === 3) {
					result = applyThreeZones(result, threshold);
				} else {
					result = result.threshold({ threshold: threshold / 255 }) as unknown as Image;
				}
			}
			return result;
		} catch {
			return currentImage;
		}
	}, [currentImage, blur, threshold, values]);

	const displayImage = showOriginal ? currentImage : processed;

	useEffect(() => {
		if (!displayImage || !previewCanvasRef.current) return;
		writeCanvas(displayImage, previewCanvasRef.current);
	}, [displayImage, previewCanvasRef]);

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

	if (!currentImage) {
		return (
			<div className='flex-1 flex items-center justify-center'>
				<div className='text-center'>
					<div className='w-24 h-24 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center'>
						<Icon name='image' size='lg' className='text-slate-400' strokeWidth={1.5} />
					</div>
					<p className='text-lg font-medium text-slate-600'>No image loaded</p>
					<p className='text-sm text-slate-500 mt-1'>Click "Open" to get started</p>
				</div>
			</div>
		);
	}

	const canvasWidth = currentImage.width;
	const canvasHeight = currentImage.height;
	const scaledWidth = canvasWidth * effectiveZoom;
	const scaledHeight = canvasHeight * effectiveZoom;

	return (
		<div ref={containerRef} className='flex-1 overflow-auto relative'>
			<div
				className='bg-white rounded-lg shadow-lg'
				style={{
					width: scaledWidth,
					height: scaledHeight,
					margin: fitMode === 'fit' ? 'auto' : undefined,
					marginTop: fitMode === 'fit' ? Math.max(0, (containerSize.height - scaledHeight) / 2) : undefined,
				}}
			>
				<canvas
					ref={previewCanvasRef}
					className='border border-slate-200 rounded'
					style={{
						transform: `scale(${effectiveZoom})`,
						transformOrigin: '0 0',
						imageRendering: 'pixelated',
					}}
				/>
			</div>
		</div>
	);
};

function applyThreeZones(image: Image, threshold: number): Image {
	const lowerThreshold = Math.max(0, threshold - UI.FILTER.THREE_ZONE_BOUNDARY);
	const upperThreshold = Math.min(255, threshold + UI.FILTER.THREE_ZONE_BOUNDARY);
	const size = image.size;
	const components = image.components;

	for (let index = 0; index < size; index++) {
		const value = image.getValueByIndex(index, 0);
		let newValue: number;
		if (value < lowerThreshold) {
			newValue = 0;
		} else if (value > upperThreshold) {
			newValue = 255;
		} else {
			newValue = 128;
		}
		for (let channel = 0; channel < components; channel++) {
			image.setValueByIndex(index, channel, newValue);
		}
	}
	return image;
}

export default Canvas;
