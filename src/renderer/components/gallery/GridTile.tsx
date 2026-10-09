import type React from 'react';
import { UI } from '../../constants/ui';
import { Button } from '../shared/Button';

interface TileGridProps {
	children: React.ReactNode;
}

/**
 * Column layout shared by every thumbnail grid in the gallery.
 *
 * Was repeated three times with an identical inline `gridTemplateColumns`.
 */
export const TileGrid: React.FC<TileGridProps> = ({ children }) => (
	<div className='grid gap-1.5' style={{ gridTemplateColumns: `repeat(${UI.GALLERY.THUMBNAIL_COLS}, minmax(0, 1fr))` }}>
		{children}
	</div>
);

interface GridTileProps {
	/** Thumbnail URL. When absent a pulsing placeholder is shown. */
	src?: string;
	alt: string;
	ariaLabel: string;
	title?: string;
	/** Bottom caption. Omitted for images shown inside their own folder. */
	caption?: string | null;
	/** Marks the currently open item (used by the Opened Items folder). */
	selected?: boolean;
	/** Shows the loading overlay and dims the tile. */
	loading?: boolean;
	/** Unsaved-changes dot. */
	dot?: boolean;
	onClick: () => void;
	onContextMenu?: (e: React.MouseEvent) => void;
}

/**
 * A single square thumbnail tile.
 *
 * The image grid, the opened-items grid and the recent-suggestions grid all
 * rendered this markup separately, which had already drifted: the recents
 * placeholder was missing its pulse and each button used a slightly different
 * class ordering, so a style change to one would not reach the others.
 */
export const GridTile: React.FC<GridTileProps> = ({
	src,
	alt,
	ariaLabel,
	title,
	caption,
	selected = false,
	loading = false,
	dot = false,
	onClick,
	onContextMenu,
}) => {
	const borderClass = loading
		? 'border-slate-400 opacity-60'
		: selected
			? 'border-slate-500 ring-1 ring-slate-400'
			: 'border-slate-200 hover:border-slate-400';

	return (
		<Button
			label={ariaLabel}
			title={title}
			disabledTone='none'
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`relative rounded-lg overflow-hidden border cursor-pointer p-0 bg-transparent ${borderClass}`}
		>
			{src ? (
				<img src={src} alt={alt} className='w-full aspect-square object-cover' />
			) : (
				<div className='w-full aspect-square bg-slate-100 animate-pulse' />
			)}

			{caption && (
				<span className='absolute bottom-0 left-0 right-0 text-[9px] text-white bg-black/60 truncate px-1 py-0.5'>
					{caption}
				</span>
			)}
			{dot && <span className='absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500' />}

			{loading && (
				<div className='absolute inset-0 flex items-center justify-center bg-white/40'>
					<span className='text-[10px] text-slate-600'>Loading...</span>
				</div>
			)}
		</Button>
	);
};
