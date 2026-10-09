import type React from 'react';

interface FolderRowProps {
	title: string;
	/** Pre-formatted subtitle, e.g. "3 images" or "2 open items". */
	subtitle: string;
	onClick: () => void;
	/** Doubles as the tooltip and the accessible name. */
	ariaLabel: string;
	/**
	 * `strong` for the virtual Opened Items folder, which is a different kind of
	 * thing from a stored folder and is weighted accordingly.
	 */
	emphasis?: 'normal' | 'strong';
	className?: string;
}

/**
 * A clickable card in the gallery panel's folder list.
 *
 * The Opened Items row and every stored folder shared the same
 * `w-full text-left p-3 bg-transparent` button wrapping a title and a count,
 * differing only in the weight of each line.
 */
export const FolderRow: React.FC<FolderRowProps> = ({
	title,
	subtitle,
	onClick,
	ariaLabel,
	emphasis = 'normal',
	className,
}) => (
	<button
		type='button'
		onClick={onClick}
		aria-label={ariaLabel}
		className={`w-full text-left p-3 bg-transparent ${className ?? ''}`}
	>
		<p
			className={`text-xs truncate ${
				emphasis === 'strong' ? 'font-semibold text-slate-800' : 'font-medium text-slate-700'
			}`}
		>
			{title}
		</p>
		<p className={`text-[10px] mt-0.5 ${emphasis === 'strong' ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>
	</button>
);
