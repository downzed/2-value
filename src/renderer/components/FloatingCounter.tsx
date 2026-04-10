import { useImageContext } from '../hooks/ImageContext';
import FloatingPanel from './FloatingPanel';

const STORAGE_KEY = 'image-editor-counter-position';
const DEFAULT_POSITION = { x: 20, y: 280 };

const PRESETS = [
	{ label: '1m', seconds: 60 },
	{ label: '5m', seconds: 300 },
	{ label: '10m', seconds: 600 },
	{ label: '15m', seconds: 900 },
];

const FloatingCounter: React.FC = () => {
	const { counter, counterRunning, counterDuration, startCounter, stopCounter, panels, setPanel } = useImageContext();

	const handleClose = () => {
		setPanel('timer', false);
	};

	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
	};

	return (
		<FloatingPanel
			title='Timer'
			storageKey={STORAGE_KEY}
			defaultPosition={DEFAULT_POSITION}
			isOpen={panels.timer}
			onClose={handleClose}
			panelStyle={{ minWidth: '160px' }}
		>
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
		</FloatingPanel>
	);
};

export default FloatingCounter;
