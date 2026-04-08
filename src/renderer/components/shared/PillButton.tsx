interface PillButtonProps {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	active?: boolean;
	size?: 'sm' | 'md';
	className?: string;
}

export const PillButton = ({ children, onClick, disabled, active, size = 'sm', className }: PillButtonProps) => {
	const sizeClass = size === 'md' ? 'px-3 py-1' : 'px-2 py-1';
	const stateClass = active ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';

	return (
		<button
			type='button'
			onClick={onClick}
			disabled={disabled}
			className={`text-xs font-medium rounded disabled:opacity-40 disabled:cursor-not-allowed ${sizeClass} ${stateClass} ${className ?? ''}`}
		>
			{children}
		</button>
	);
};
