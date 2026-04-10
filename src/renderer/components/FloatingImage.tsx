import { writeCanvas } from 'image-js';
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import FloatingPanel from './FloatingPanel';

const STORAGE_KEY = 'image-editor-original-position';
const DEFAULT_POSITION = { x: 20, y: 20 };

const FloatingImage: React.FC = () => {
	const { originalImage, showOriginal, toggleShowOriginal, panels, setPanel } = useImageContext();
	const [showKey, setShowKey] = useState(0);
	const originalCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (originalImage) {
			setPanel('original', true);
			setShowKey((k) => k + 1);
		}
	}, [originalImage, setPanel]);

	useEffect(() => {
		if (!originalImage || !originalCanvasRef.current || !showKey) return;

		const canvas = originalCanvasRef.current;
		writeCanvas(originalImage, canvas);
	}, [originalImage, showKey]);

	// Re-render canvas when panel opens (it may have been unmounted)
	useEffect(() => {
		if (panels.original && originalImage) {
			setShowKey((k) => k + 1);
		}
	}, [panels.original, originalImage]);

	const handleClose = () => {
		setPanel('original', false);
	};

	if (!originalImage) return null;

	const eyeToggle = (
		<button
			type='button'
			onClick={toggleShowOriginal}
			className='text-slate-400 hover:text-slate-600 transition-colors'
			title={showOriginal ? 'Show Processed' : 'Show Original'}
		>
			{showOriginal ? (
				<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>processed</title>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
					/>
				</svg>
			) : (
				<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>original</title>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
					/>
				</svg>
			)}
		</button>
	);

	return (
		<FloatingPanel
			title='Original'
			storageKey={STORAGE_KEY}
			defaultPosition={DEFAULT_POSITION}
			isOpen={panels.original}
			onClose={handleClose}
			titleBarActions={eyeToggle}
			panelStyle={{ width: '40%', maxWidth: '350px' }}
			zClass='z-40'
		>
			<div className='p-2'>
				<canvas ref={originalCanvasRef} key={showKey} className='w-full border border-slate-200 rounded' />
			</div>
		</FloatingPanel>
	);
};

export default FloatingImage;
