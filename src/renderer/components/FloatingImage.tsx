import { writeCanvas } from 'image-js';
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import { useDraggablePanel } from '../hooks/useDraggablePanel';

const STORAGE_KEY = 'image-editor-original-position';
const DEFAULT_POSITION = { x: 20, y: 20 };

const FloatingImage: React.FC = () => {
	const { originalImage, showOriginal, toggleShowOriginal } = useImageContext();
	const [isClosed, setIsClosed] = useState(false);
	const [showKey, setShowKey] = useState(0);
	const panelRef = useRef<HTMLDivElement>(null);
	const originalCanvasRef = useRef<HTMLCanvasElement>(null);

	const { isDragging, position, handleMouseDown } = useDraggablePanel({
		storageKey: STORAGE_KEY,
		defaultPosition: DEFAULT_POSITION,
		panelRef,
	});

	useEffect(() => {
		if (originalImage) {
			setIsClosed(false);
			setShowKey((k) => k + 1);
		}
	}, [originalImage]);

	useEffect(() => {
		if (!originalImage || !originalCanvasRef.current || !showKey) return;

		const canvas = originalCanvasRef.current;
		writeCanvas(originalImage, canvas);
	}, [originalImage, showKey]);

	const handleClose = () => {
		setIsClosed(true);
	};

	const handleToggle = () => {
		setIsClosed(false);
		setShowKey((k) => k + 1);
	};

	if (!originalImage) return null;

	if (isClosed) {
		return (
			<button
				type='button'
				onClick={handleToggle}
				className='fixed bottom-24 left-16 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors z-50'
				title='Show Original'
			>
				<svg className='w-5 h-5 text-slate-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>preview</title>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
					/>
				</svg>
			</button>
		);
	}

	return (
		<div
			ref={panelRef}
			className='fixed bg-white rounded-lg shadow-xl border border-slate-200 z-40 select-none'
			style={{
				left: position.x,
				top: position.y,
				cursor: isDragging ? 'grabbing' : 'grab',
				width: '40%',
				maxWidth: '350px',
			}}
		>
			<div
				onMouseDown={handleMouseDown}
				className='flex items-center justify-between px-3 py-2 border-b border-slate-100 cursor-grab active:cursor-grabbing'
			>
				<div className='flex items-center gap-2'>
					<span className='text-slate-400'>⋮⋮</span>
					<span className='text-xs font-semibold text-slate-700'>Original</span>
				</div>
				<div className='flex items-center gap-2'>
					<button
						type='button'
						onClick={toggleShowOriginal}
						className='text-slate-400 hover:text-slate-600 transition-colors'
						title={showOriginal ? 'Show Processed' : 'Show Original'}
					>
						{showOriginal ? (
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<title>processed</title>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
								/>
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
					<button type='button' onClick={handleClose} className='text-slate-400 hover:text-slate-600 transition-colors'>
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<title>close</title>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
						</svg>
					</button>
				</div>
			</div>

			<div className='p-2'>
				<canvas ref={originalCanvasRef} key={showKey} className='w-full border border-slate-200 rounded' />
			</div>
		</div>
	);
};

export default FloatingImage;
