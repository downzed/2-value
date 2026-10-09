import { useEditorStore, useEditorSelector } from '../react/useStore';
import { selectCounter, selectCounterDuration, selectCounterRunning, selectTimerOpen } from '../core/selectors';
import FloatingWidget from './shared/FloatingWidget';
import { PillButton } from './shared/PillButton';

const STORAGE_KEY = 'image-editor-counter-position';
const DEFAULT_POSITION = { x: 20, y: 312 };

const PRESETS = [
	{ label: '1m', seconds: 60 },
	{ label: '5m', seconds: 300 },
	{ label: '10m', seconds: 600 },
	{ label: '15m', seconds: 900 },
];

const FloatingCounter: React.FC = () => {
	const editor = useEditorStore();
	const { startCounter, stopCounter, setPanel } = editor;
	const counter = useEditorSelector(selectCounter);
	const counterRunning = useEditorSelector(selectCounterRunning);
	const counterDuration = useEditorSelector(selectCounterDuration);
	const isOpen = useEditorSelector(selectTimerOpen);

	const handleClose = () => {
		setPanel('timer', false);
	};

	/**
	 * Full time for the timer readout: `45` under a minute, `5:00` above.
	 *
	 * The status bar's panel-toggle badge uses a deliberately more compact form
	 * (`3m`); see the note on `formatBadge` in `shell/TopPanel.tsx`.
	 */
	const formatTime = (seconds: number): string => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
	};

	return (
		<FloatingWidget
			title='Timer'
			storageKey={STORAGE_KEY}
			defaultPosition={DEFAULT_POSITION}
			isOpen={isOpen}
			onClose={handleClose}
			panelStyle={{ minWidth: '160px' }}
		>
			<div className='p-3 space-y-3'>
				<div className='flex items-center justify-center gap-1'>
					{PRESETS.map((preset) => (
						<PillButton
							key={preset.seconds}
							onClick={() => startCounter(preset.seconds)}
							disabled={counterRunning}
							active={counterDuration === preset.seconds && !counterRunning}
						>
							{preset.label}
						</PillButton>
					))}
				</div>

				<div className='text-center'>
					<span className='text-2xl font-mono text-slate-700'>{formatTime(counter)}</span>
					<span className='text-xs text-slate-500 ml-1'>
						{counterRunning && counterDuration ? 'remaining' : 'total'}
					</span>
				</div>

				<div className='flex items-center justify-center gap-2'>
					<PillButton
						size='md'
						tone={counterRunning ? 'danger' : 'success'}
						onClick={counterRunning ? stopCounter : () => counterDuration && startCounter(counterDuration)}
						disabled={!counterDuration && !counterRunning}
					>
						{counterRunning ? 'Stop' : 'Start'}
					</PillButton>
					<PillButton onClick={stopCounter} disabled={!counterRunning && counter === 0} size='md'>
						Reset
					</PillButton>
				</div>
			</div>
		</FloatingWidget>
	);
};

export default FloatingCounter;
