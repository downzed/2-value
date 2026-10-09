import type { ReactNode } from 'react';
import { Button } from './Button';

export interface SegmentedOption<T extends string | number> {
	value: T;
	label: ReactNode;
	title?: string;
}

interface SegmentedControlProps<T extends string | number> {
	options: SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	disabled?: boolean;
	/**
	 * `light` for the white floating panels, `dark` for the slate status bar.
	 * Both differ in container, active and inactive colours, and slightly in
	 * padding, so the tone drives all four rather than them being duplicated per
	 * call site.
	 */
	tone?: 'light' | 'dark';
}

const TONES = {
	light: {
		container: 'flex items-center bg-slate-100 rounded p-0.5',
		button: 'px-2 py-1 text-xs font-medium rounded transition-colors',
		active: 'bg-white shadow text-slate-800',
		inactive: 'text-slate-500 hover:text-slate-700',
	},
	dark: {
		container: 'flex items-center bg-slate-700/50 rounded p-0.5',
		button: 'px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors',
		active: 'bg-slate-500 text-slate-100 shadow-sm',
		inactive: 'text-slate-400 hover:text-slate-200',
	},
} as const;

/**
 * A row of mutually exclusive buttons.
 *
 * Used for the 2/3 value toggle in the adjustments panel and for
 * Fit / 1:1 / 2x in the status bar, which were two separate hand-rolled copies
 * of the same markup with different class strings.
 */
export function SegmentedControl<T extends string | number>({
	options,
	value,
	onChange,
	disabled = false,
	tone = 'light',
}: SegmentedControlProps<T>) {
	const t = TONES[tone];
	return (
		// No role: each button carries aria-pressed, which is what conveys the toggle.
		<div className={t.container}>
			{options.map((option) => (
				<Button
					key={String(option.value)}
					pressed={option.value === value}
					onClick={() => onChange(option.value)}
					disabled={disabled}
					title={option.title}
					className={`${t.button} ${option.value === value ? t.active : t.inactive}`}
				>
					{option.label}
				</Button>
			))}
		</div>
	);
}
