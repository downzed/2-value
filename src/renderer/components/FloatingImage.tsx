import { writeCanvas } from 'image-js';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import { useDraggablePanel } from '../hooks/useDraggablePanel';

const STORAGE_KEY = 'image-editor-original-position';
const DEFAULT_POSITION = { x: 20, y: 20 };
const DEFAULT_SIZE = 40;

const FloatingImage: React.FC = () => {
	const { originalImage } = useImageContext();
	const [isClosed, setIsClosed] = useState(false);
	const [size] = useState(DEFAULT_SIZE);
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

	if (!originalImage) {
		return null;
	}

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
				width: `${size}%`,
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
				<button type='button' onClick={handleClose} className='text-slate-400 hover:text-slate-600 transition-colors'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<title>close</title>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
					</svg>
				</button>
			</div>

			<div className='p-2'>
				<canvas ref={originalCanvasRef} key={showKey} className='w-full border border-slate-200 rounded' />
			</div>
		</div>
	);
};

export default FloatingImage;
