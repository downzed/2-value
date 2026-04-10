import { type Image, writeCanvas } from 'image-js';
import { useEffect, useMemo } from 'react';
import { useImageContext } from '../hooks/ImageContext';

interface CanvasProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

function posterizeThreeValue(image: Image, thresholdValue: number): Image {
  const data = image.data;
  // Convert threshold from 0-255 range to use for zone boundaries
  // We'll create zones: black (0-threshold), gray (threshold-range to threshold+range), white (threshold+range to 255)
  // But we need to ensure valid ranges
  const range = Math.min(thresholdValue, 255 - thresholdValue) * 0.4; // 40% of distance to nearest edge
  const lowerBound = Math.max(0, thresholdValue - range);
  const upperBound = Math.min(255, thresholdValue + range);
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    if (gray < lowerBound) {
      data[i] = data[i + 1] = data[i + 2] = 0; // black
    } else if (gray > upperBound) {
      data[i] = data[i + 1] = data[i + 2] = 255; // white
    } else {
      data[i] = data[i + 1] = data[i + 2] = 128; // gray
    }
  }
  return image;
}

const Canvas: React.FC<CanvasProps> = ({ previewCanvasRef }) => {
	const { currentImage, blur, threshold, values, showOriginal, toggleShowOriginal } = useImageContext();

	const processed = useMemo(() => {
		if (!currentImage) return null;
		let result = currentImage.clone();
		try {
			if (values === 3 || threshold > 0) {
				result = result.grey();
			}
			if (blur > 0) {
				result = result.gaussianBlur({ sigma: blur });
			}
if (values === 3) {
      result = posterizeThreeValue(result, threshold);
    } else if (threshold > 0) {
      result = result.threshold({ threshold: threshold / 255 });
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
						<svg className='w-12 h-12 text-slate-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<title>empty-image</title>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={1.5}
								d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
							/>
						</svg>
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
				<canvas
					ref={previewCanvasRef}
					className='max-w-full max-h-full border border-slate-200 rounded cursor-pointer'
					onClick={toggleShowOriginal}
				/>
			</div>
		</div>
	);
};

export default Canvas;
