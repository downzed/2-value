import type React from 'react';
import { useMemo } from 'react';
import type { GalleryImage } from '../../../shared/types';
import { getRecents, RECENTS_MAX } from '../../utils/storage';
import { GridTile, TileGrid } from './GridTile';

interface RecentSuggestionsProps {
	images: GalleryImage[];
	/** Currently open editor items; recents are hidden while any are open. */
	openItemCount: number;
	/** Object URLs by gallery image id, from `useThumbnailUrls`. */
	thumbnailUrls: Record<string, string>;
	onOpen: (galleryImageId: string) => void;
}

/**
 * "What did I open recently?" grid, shown while the editor has nothing open.
 *
 * Recents live in localStorage while the gallery lives in IndexedDB, so an entry
 * can outlive the image it points at — those are filtered out here rather than
 * producing tiles that fail to load.
 */
export const RecentSuggestions: React.FC<RecentSuggestionsProps> = ({
	images,
	openItemCount,
	thumbnailUrls,
	onOpen,
}) => {
	const recentEntries = useMemo(
		() =>
			openItemCount === 0
				? getRecents()
						.filter((entry) => images.some((i) => i.id === entry.galleryImageId))
						.slice(0, RECENTS_MAX)
				: [],
		[images, openItemCount],
	);

	if (recentEntries.length === 0) return null;

	return (
		<div className='mb-4 space-y-1.5'>
			<p className='text-[10px] font-medium text-slate-500 uppercase tracking-wide'>Recent</p>
			<TileGrid>
				{recentEntries.map((entry) => (
					<GridTile
						key={entry.galleryImageId}
						src={thumbnailUrls[entry.galleryImageId]}
						alt={entry.fileName}
						ariaLabel={`Open ${entry.fileName}`}
						title={entry.fileName}
						caption={entry.fileName}
						onClick={() => onOpen(entry.galleryImageId)}
					/>
				))}
			</TileGrid>
		</div>
	);
};
