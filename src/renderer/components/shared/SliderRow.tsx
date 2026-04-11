interface SliderRowProps {
	label: string;
	id: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onChange: (value: number) => void;
	disabled?: boolean;
	valueWidth?: string;
	parseValue?: (raw: string) => number;
}

export const SliderRow = ({
	label,
	id,
	min,
	max,
	step,
	value,
	onChange,
	disabled,
	valueWidth,
	parseValue,
}: SliderRowProps) => {
	return (
		<div className='flex items-center gap-2'>
			<label htmlFor={id} className='text-xs font-medium text-slate-600 w-14'>
				{label}
			</label>
			<input
				id={id}
				type='range'
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange((parseValue ?? parseFloat)(e.target.value))}
				disabled={disabled}
				className='flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50'
			/>
			<span className={`text-xs text-slate-500 ${valueWidth ?? 'w-8'} text-right`}>{value}</span>
		</div>
	);
};
