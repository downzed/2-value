import { Button } from './Button';

interface PillButtonProps {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	active?: boolean;
	size?: 'sm' | 'md';
	/**
	 * `subtle` is the grey default. `success` and `danger` are solid accents for
	 * the single most important action in a panel, where a grey pill would not
	 * read as the primary choice.
	 */
	tone?: 'subtle' | 'success' | 'danger';
	className?: string;
}

const TONES = {
	subtle: {
		on: 'bg-slate-700 text-white',
		off: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
	},
	success: {
		on: 'bg-emerald-500 text-white hover:bg-emerald-600',
		off: 'bg-emerald-500 text-white hover:bg-emerald-600',
	},
	danger: {
		on: 'bg-red-500 text-white hover:bg-red-600',
		off: 'bg-red-500 text-white hover:bg-red-600',
	},
} as const;

export const PillButton = ({
	children,
	onClick,
	disabled,
	active,
	size = 'sm',
	tone = 'subtle',
	className,
}: PillButtonProps) => {
	const sizeClass = size === 'md' ? 'px-3 py-1' : 'px-2 py-1';
	// Solid accents have no off state, so `active` never changes their colour.
	const stateClass = tone === 'subtle' && active ? TONES.subtle.on : TONES[tone].off;

	return (
		<Button
			disabled={disabled}
			onClick={onClick}
			// Only the subtle tone carries a pressed state; a solid accent button is
			// not a toggle and must not claim to be one.
			pressed={tone === 'subtle' && active ? true : undefined}
			className={`text-xs font-medium rounded ${sizeClass} ${stateClass} ${className ?? ''}`}
		>
			{children}
		</Button>
	);
};
