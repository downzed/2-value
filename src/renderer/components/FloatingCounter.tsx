import { useRef, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import { useDraggablePanel } from '../hooks/useDraggablePanel';

const STORAGE_KEY = 'image-editor-counter-position';
const DEFAULT_POSITION = { x: 20, y: 280 };

const PRESETS = [
	{ label: '1m', seconds: 60 },
	{ label: '5m', seconds: 300 },
	{ label: '10m', seconds: 600 },
	{ label: '15m', seconds: 900 },
];

const FloatingCounter: React.FC = () => {
	const { counter, counterRunning, counterDuration, startCounter, stopCounter } = useImageContext();
	const [isClosed, setIsClosed] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const { isDragging, position, handleMouseDown } = useDraggablePanel({
		storageKey: STORAGE_KEY,
		defaultPosition: DEFAULT_POSITION,
		panelRef,
	});

	const handleClose = () => {
		setIsClosed(true);
	};

	const handleToggle = () => {
		setIsClosed(false);
	};

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
	};

	if (isClosed) {
		return (
			<button
				type='button'
				onClick={handleToggle}
				className='fixed bottom-24 left-28 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors z-50'
				title={counterRunning ? `Timer: ${formatTime(counter)} remaining` : 'Show Timer'}
			>
				<div className='relative'>
					<svg className='w-5 h-5 text-slate-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<title>timer</title>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							strokeWidth={2}
							d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
						/>
					</svg>
					{counterRunning && counterDuration && (
						<span className='absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center'>
							{counter < 60 ? counter : Math.floor(counter / 60)}
						</span>
					)}
				</div>
			</button>
		);
	}

	return (
		<div
			ref={panelRef}
			className='fixed bg-white rounded-lg shadow-xl border border-slate-200 z-50 select-none'
			style={{
				left: position.x,
				top: position.y,
				cursor: isDragging ? 'grabbing' : 'grab',
				minWidth: '160px',
			}}
		>
			<div
				role='toolbar'
				onMouseDown={handleMouseDown}
				className='flex items-center justify-between px-3 py-2 border-b border-slate-100 cursor-grab active:cursor-grabbing'
			>
				<div className='flex items-center gap-2'>
					<span className='text-slate-400'>⋮⋮</span>
					<span className='text-xs font-semibold text-slate-700'>Timer</span>
				</div>
				<button type='button' onClick={handleClose} className='text-slate-400 hover:text-slate-600 transition-colors'>
					<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<title>close</title>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
					</svg>
				</button>
			</div>

			<div className='p-3 space-y-3'>
				<div className='flex items-center justify-center gap-1'>
					{PRESETS.map((preset) => (
						<button
							key={preset.seconds}
							type='button'
							onClick={() => startCounter(preset.seconds)}
							disabled={counterRunning}
							className={`px-2 py-1 text-xs font-medium rounded ${
								counterDuration === preset.seconds && !counterRunning
									? 'bg-slate-700 text-white'
									: 'bg-slate-100 text-slate-600 hover:bg-slate-200'
							} disabled:opacity-40 disabled:cursor-not-allowed`}
						>
							{preset.label}
						</button>
					))}
				</div>

				<div className='text-center'>
					<span className='text-2xl font-mono text-slate-700'>{formatTime(counter)}</span>
					<span className='text-xs text-slate-500 ml-1'>
						{counterRunning && counterDuration ? 'remaining' : 'total'}
					</span>
				</div>

				<div className='flex items-center justify-center gap-2'>
					<button
						type='button'
						onClick={counterRunning ? stopCounter : () => counterDuration && startCounter(counterDuration)}
						disabled={!counterDuration && !counterRunning}
						className={`px-3 py-1 text-xs font-medium rounded ${
							counterRunning
								? 'bg-red-500 text-white hover:bg-red-600'
								: 'bg-emerald-500 text-white hover:bg-emerald-600'
						} disabled:opacity-40 disabled:cursor-not-allowed`}
					>
						{counterRunning ? 'Stop' : 'Start'}
					</button>
					<button
						type='button'
						onClick={stopCounter}
						disabled={!counterRunning && counter === 0}
						className='px-3 py-1 text-xs font-medium rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
					>
						Reset
					</button>
				</div>
			</div>
		</div>
	);
};

export default FloatingCounter;
