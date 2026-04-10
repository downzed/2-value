import { useEffect, useState } from 'react';
import { useImageContext } from '../hooks/ImageContext';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { UI } from '../constants/ui';
import FloatingPanel from './FloatingPanel';

const STORAGE_KEY = 'image-editor-controls-position';
const DEFAULT_POSITION = { x: 20, y: 100 };

const FloatingControls: React.FC = () => {
	const {
		hasImage,
		blur,
		threshold,
		values,
		setBlur,
		setThreshold,
		setValues,
		resetControls,
		applyPreset,
		undo,
		redo,
		canUndo,
		canRedo,
		panels,
		setPanel,
	} = useImageContext();

	const [localBlur, setLocalBlur] = useState(blur);
	const [localThreshold, setLocalThreshold] = useState(threshold);

	const { call: debouncedSetBlur, cancel: cancelBlur } = useDebouncedCallback(setBlur, 150);
	const { call: debouncedSetThreshold, cancel: cancelThreshold } = useDebouncedCallback(setThreshold, 150);

	useEffect(() => {
		setLocalBlur(blur);
	}, [blur]);

	useEffect(() => {
		setLocalThreshold(threshold);
	}, [threshold]);

	useEffect(() => {
		if (hasImage) {
			setPanel('controls', true);
		} else {
			cancelBlur();
			cancelThreshold();
		}
	}, [hasImage, cancelBlur, cancelThreshold, setPanel]);

	const handleBlurChange = (value: number) => {
		setLocalBlur(value);
		debouncedSetBlur(value);
	};

	const handleThresholdChange = (value: number) => {
		setLocalThreshold(value);
		debouncedSetThreshold(value);
	};

	const handleReset = () => {
		cancelBlur();
		cancelThreshold();
		resetControls();
	};

	const handleClose = () => {
		setPanel('controls', false);
	};

	const isPresetActive = (preset: (typeof UI.PRESETS)[number]) =>
		blur === preset.blur && threshold === preset.threshold && values === preset.values;

	return (
		<FloatingPanel
			title='Adjustments'
			storageKey={STORAGE_KEY}
			defaultPosition={DEFAULT_POSITION}
			isOpen={panels.controls}
			onClose={handleClose}
			panelStyle={{ minWidth: '220px' }}
		>
			<div className='p-3 space-y-3'>
				{/* PRESETS section */}
				<div className='space-y-1.5'>
					<span className='text-[10px] uppercase tracking-wider text-slate-400 font-semibold'>Presets</span>
					<div className='flex items-center gap-1'>
						{UI.PRESETS.map((preset) => (
							<button
								key={preset.name}
								type='button'
								onClick={() => applyPreset(preset)}
								disabled={!hasImage}
								className={`px-2 py-1 text-xs font-medium rounded ${
									isPresetActive(preset) ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
								} disabled:opacity-40 disabled:cursor-not-allowed`}
							>
								{preset.name}
							</button>
						))}
					</div>
				</div>

				<div className='border-t border-slate-100' />

				{/* ADJUSTMENTS section */}
				<div className='space-y-2'>
					<span className='text-[10px] uppercase tracking-wider text-slate-400 font-semibold'>Adjustments</span>

					<div className='flex items-center gap-2'>
						<label htmlFor='blur-range' className='text-xs font-medium text-slate-600 w-14'>
							Blur
						</label>
						<input
							id='blur-range'
							type='range'
							min={UI.FILTER.BLUR_MIN}
							max={UI.FILTER.BLUR_MAX}
							step={UI.FILTER.BLUR_STEP}
							value={localBlur}
							onChange={(e) => handleBlurChange(Number.parseFloat(e.target.value))}
							disabled={!hasImage}
							className='flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50'
						/>
						<span className='text-xs text-slate-500 w-6 text-right'>{localBlur}</span>
					</div>

					<div className='flex items-center gap-2'>
						<label htmlFor='thresh-range' className='text-xs font-medium text-slate-600 w-14'>
							Thresh
						</label>
						<input
							type='range'
							id='thresh-range'
							min={UI.FILTER.THRESHOLD_MIN}
							max={UI.FILTER.THRESHOLD_MAX}
							value={localThreshold}
							onChange={(e) => handleThresholdChange(Number.parseInt(e.target.value, 10))}
							disabled={!hasImage}
							className='flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50'
						/>
						<span className='text-xs text-slate-500 w-8 text-right'>{localThreshold}</span>
					</div>

					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-1 bg-slate-100 rounded p-0.5'>
							<button
								type='button'
								onClick={() => setValues(2)}
								disabled={!hasImage}
								className={`px-2 py-1 text-xs font-medium rounded ${
									values === 2 ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
								}`}
							>
								2
							</button>
							<button
								type='button'
								onClick={() => setValues(3)}
								disabled={!hasImage}
								className={`px-2 py-1 text-xs font-medium rounded ${
									values === 3 ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
								}`}
							>
								3
							</button>
						</div>
						<button
							type='button'
							onClick={handleReset}
							disabled={!hasImage}
							className='text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed'
						>
							Reset
						</button>
					</div>
				</div>

				<div className='border-t border-slate-100' />

				{/* HISTORY section */}
				<div className='space-y-1.5'>
					<span className='text-[10px] uppercase tracking-wider text-slate-400 font-semibold'>History</span>
					<div className='flex items-center gap-2'>
						<button
							type='button'
							onClick={undo}
							disabled={!canUndo}
							title='Undo (Ctrl+Z)'
							className='flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
						>
							<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<title>undo</title>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4'
								/>
							</svg>
							Undo
						</button>
						<button
							type='button'
							onClick={redo}
							disabled={!canRedo}
							title='Redo (Ctrl+Shift+Z)'
							className='flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
						>
							Redo
							<svg className='w-3 h-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<title>redo</title>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4'
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		</FloatingPanel>
	);
};

export default FloatingControls;
