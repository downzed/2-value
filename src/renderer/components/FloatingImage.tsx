import { writeCanvas } from 'image-js';
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import FloatingWidget from './shared/FloatingWidget';
import { Icon } from './shared/Icon';

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
			{showOriginal ? <Icon name='eye-open' /> : <Icon name='eye-closed' />}
		</button>
	);

	return (
		<FloatingWidget
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
		</FloatingWidget>
	);
};

export default FloatingImage;
