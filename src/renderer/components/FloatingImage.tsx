import { useEffect, useRef, useState } from 'react';
import { selectActiveImage, selectShowOriginal } from '../core/selectors';
import { useEditorStore, useEditorSelector } from '../react/useStore';
import { imageToImageData } from '../utils/imageConversion';
import FloatingWidget from './shared/FloatingWidget';
import { Icon } from './shared/Icon';
import { IconButton } from './shared/IconButton';

const STORAGE_KEY = 'image-editor-original-position';
const DEFAULT_POSITION = { x: 20, y: 52 };

const FloatingImage: React.FC = () => {
	const editor = useEditorStore();
	const { toggleShowOriginal, setPanel } = editor;
	const originalImage = useEditorSelector(selectActiveImage);
	const showOriginal = useEditorSelector(selectShowOriginal);
	const isOpen = useEditorSelector((s) => s.panels.original);
	const [showKey, setShowKey] = useState(0);
	const originalCanvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (originalImage) {
			setPanel('original', true);
			setShowKey((k) => k + 1);
		}
	}, [originalImage, setPanel]);

	// Render canvas only when panel is open (lazy render — avoids holding large backing store when hidden)
	useEffect(() => {
		if (!isOpen || !originalImage) {
			// Clear canvas backing store to free memory when panel is not visible
			if (originalCanvasRef.current) {
				originalCanvasRef.current.width = 0;
				originalCanvasRef.current.height = 0;
			}
			return;
		}
		// Trigger redraw when panel opens
		setShowKey((k) => k + 1);
	}, [isOpen, originalImage]);

	useEffect(() => {
		if (!originalImage || !originalCanvasRef.current || !showKey || !isOpen) return;

		const canvas = originalCanvasRef.current;
		// Write source image as raw RGBA ImageData using getRawImage() (avoids private .data access)
		canvas.width = originalImage.width;
		canvas.height = originalImage.height;
		const ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.putImageData(imageToImageData(originalImage), 0, 0);
		}
	}, [originalImage, showKey, isOpen]);

	const handleClose = () => {
		setPanel('original', false);
	};

	if (!originalImage) return null;

	const eyeToggle = (
		<IconButton
			tone='pressed'
			active={showOriginal}
			onClick={toggleShowOriginal}
			title={showOriginal ? 'Show Processed' : 'Show Original'}
		>
			{showOriginal ? <Icon name='eye-open' /> : <Icon name='eye-closed' />}
		</IconButton>
	);

	return (
		<FloatingWidget
			title='Original'
			storageKey={STORAGE_KEY}
			defaultPosition={DEFAULT_POSITION}
			isOpen={isOpen}
			onClose={handleClose}
			titleBarActions={eyeToggle}
			panelStyle={{ width: '40%', maxWidth: '350px', maxHeight: '60vh' }}
			zClass='z-40'
		>
			{/* Title bar is ~40px (px-3 py-2 + border), subtract from maxHeight */}
			<div className='overflow-auto' style={{ maxHeight: 'calc(60vh - 40px)' }}>
				<canvas ref={originalCanvasRef} key={showKey} className='w-full border border-slate-200 rounded-b-md' />
			</div>
		</FloatingWidget>
	);
};

export default FloatingImage;
