import { type Image, writeCanvas } from 'image-js';
import { useEffect, useMemo } from 'react';
import { UI } from '../constants/ui';
import { useImageContext } from '../hooks/ImageContext';
import { Icon } from './shared/Icon';

interface CanvasProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const Canvas: React.FC<CanvasProps> = ({ previewCanvasRef }) => {
	const { currentImage, blur, threshold, values, showOriginal } = useImageContext();

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

	return (
		<div className='flex-1 flex items-center justify-center p-8'>
			<div className='bg-white rounded-lg shadow-lg p-4'>
				<canvas ref={previewCanvasRef} className='max-w-full max-h-full border border-slate-200 rounded' />
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
