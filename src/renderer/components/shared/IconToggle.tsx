import type React from 'react';
import type { ReactNode } from 'react';

interface IconToggleProps {
	children: ReactNode;
	onClick: () => void;
	active: boolean;
	title: string;
	/** Hosts an absolutely positioned badge, e.g. the timer's remaining time. */
	badge?: ReactNode;
	className?: string;
}

/**
 * Square icon button with an on/off state, for the status bar's panel toggles.
 *
 * The four panel buttons were four near-identical blocks differing only in icon,
 * title and active state.
 */
export const IconToggle: React.FC<IconToggleProps> = ({ children, onClick, active, title, badge, className }) => {
	const stateClass = active ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700';
	// Only position relatively when a badge needs anchoring.
	const positionClass = badge ? 'relative ' : '';

	return (
		<button
			type='button'
			onClick={onClick}
			aria-pressed={active}
			aria-label={title}
			title={title}
			className={`${positionClass}w-6 h-6 flex items-center justify-center rounded transition-colors ${stateClass} ${className ?? ''}`}
		>
			{children}
			{badge}
		</button>
	);
};
