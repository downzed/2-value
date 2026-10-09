import { useEffect, useState } from 'react';
import { UI } from '../constants/ui';
import {
	selectBlur,
	selectCanRedo,
	selectCanUndo,
	selectHasImage,
	selectThreshold,
	selectValues,
} from '../core/selectors';
import { useEditorStore, useEditorSelector } from '../react/useStore';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import FloatingWidget from './shared/FloatingWidget';
import { Icon } from './shared/Icon';
import { SegmentedControl } from './shared/SegmentedControl';
import { PillButton } from './shared/PillButton';
import { SectionHeader } from './shared/SectionHeader';
import { SliderRow } from './shared/SliderRow';

const STORAGE_KEY = 'image-editor-controls-position';
const DEFAULT_POSITION = { x: 20, y: 132 };

const FloatingControls: React.FC = () => {
	const editor = useEditorStore();
	const { setBlur, setThreshold, setValues, resetControls, applyPreset, undo, redo, setPanel } = editor;

	const hasImage = useEditorSelector(selectHasImage);
	const blur = useEditorSelector(selectBlur);
	const threshold = useEditorSelector(selectThreshold);
	const values = useEditorSelector(selectValues);
	const canUndo = useEditorSelector(selectCanUndo);
	const canRedo = useEditorSelector(selectCanRedo);
	const isOpen = useEditorSelector((s) => s.panels.controls);

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
		<FloatingWidget
			title='Adjustments'
			storageKey={STORAGE_KEY}
			defaultPosition={DEFAULT_POSITION}
			isOpen={isOpen}
			onClose={handleClose}
			panelStyle={{ minWidth: '220px' }}
		>
			<div className='p-3 space-y-3'>
				{/* PRESETS section */}
				<div className='space-y-1.5'>
					<SectionHeader>Presets</SectionHeader>
					<div className='flex items-center gap-1'>
						{UI.PRESETS.map((preset) => (
							<PillButton
								key={preset.name}
								onClick={() => applyPreset(preset)}
								disabled={!hasImage}
								active={isPresetActive(preset)}
							>
								{preset.name}
							</PillButton>
						))}
					</div>
				</div>

				<div className='border-t border-slate-100' />

				{/* ADJUSTMENTS section */}
				<div className='space-y-2'>
					<SectionHeader>Adjustments</SectionHeader>

					<SliderRow
						label='Blur'
						id='blur-range'
						min={UI.FILTER.BLUR_MIN}
						max={UI.FILTER.BLUR_MAX}
						step={UI.FILTER.BLUR_STEP}
						value={localBlur}
						onChange={handleBlurChange}
						disabled={!hasImage}
						valueWidth='w-6'
					/>

					<SliderRow
						label='Thresh'
						id='thresh-range'
						min={UI.FILTER.THRESHOLD_MIN}
						max={UI.FILTER.THRESHOLD_MAX}
						step={UI.FILTER.THRESHOLD_STEP}
						value={localThreshold}
						onChange={handleThresholdChange}
						disabled={!hasImage}
						parseValue={(v) => Number.parseInt(v, 10)}
					/>

					<div className='flex items-center justify-between'>
						<SegmentedControl
							options={[
								{ value: 2, label: '2' },
								{ value: 3, label: '3' },
							]}
							value={values}
							onChange={setValues}
							disabled={!hasImage}
						/>
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
					<SectionHeader>History</SectionHeader>
					<div className='flex items-center gap-2'>
						<PillButton onClick={undo} disabled={!canUndo} className='flex items-center gap-1'>
							<Icon name='undo' size='sm' />
							Undo
						</PillButton>
						<PillButton onClick={redo} disabled={!canRedo} className='flex items-center gap-1'>
							Redo
							<Icon name='redo' size='sm' />
						</PillButton>
					</div>
				</div>
			</div>
		</FloatingWidget>
	);
};

export default FloatingControls;
