import { useCallback, useState } from 'react';
import type { PinterestBoard } from '../../shared/pinterest-types';
import { PINTEREST_PANEL_DEFAULT_POSITION, PINTEREST_PANEL_STORAGE_KEY } from '../constants/pinterest';
import { usePinterestContext } from '../context/PinterestContext';
import { useImageContext } from '../hooks/ImageContext';
import FloatingWidget from './shared/FloatingWidget';
import { Icon } from './shared/Icon';
import { PillButton } from './shared/PillButton';
import { SectionHeader } from './shared/SectionHeader';

interface PinterestPanelProps {
	previewCanvasRef: React.RefObject<HTMLCanvasElement | null>;
	isOpen: boolean;
	onClose: () => void;
}

const BoardItem: React.FC<{
	board: PinterestBoard;
	isSelected: boolean;
	onSelect: (id: string) => void;
}> = ({ board, isSelected, onSelect }) => (
	<button
		type='button'
		onClick={() => onSelect(board.id)}
		className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
			isSelected
				? 'bg-red-50 text-red-700 font-medium border border-red-200'
				: 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
		}`}
	>
		<div className='font-medium truncate'>{board.name}</div>
		{board.description && <div className='text-[10px] text-slate-400 truncate'>{board.description}</div>}
		<div className='text-[10px] text-slate-400'>{board.pin_count} pins</div>
	</button>
);

const PinterestPanel: React.FC<PinterestPanelProps> = ({ previewCanvasRef, isOpen, onClose }) => {
	const { hasImage } = useImageContext();
	const {
		isAuthenticated,
		isLoading,
		error,
		boards,
		selectedBoardId,
		initiateAuth,
		logout,
		fetchBoards,
		selectBoard,
		savePin,
		clearError,
	} = usePinterestContext();

	const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

	const handleSaveToBoard = useCallback(async () => {
		if (!previewCanvasRef.current || !selectedBoardId) return;

		setSaveStatus('saving');
		clearError();

		const canvas = previewCanvasRef.current;
		const imageDataUrl = canvas.toDataURL('image/png');

		const result = await savePin({ boardId: selectedBoardId, imageDataUrl });
		if (result.ok) {
			setSaveStatus('saved');
			setTimeout(() => setSaveStatus('idle'), 2000);
		} else {
			setSaveStatus('error');
		}
	}, [previewCanvasRef, selectedBoardId, savePin, clearError]);

	return (
		<FloatingWidget
			title='Pinterest'
			storageKey={PINTEREST_PANEL_STORAGE_KEY}
			defaultPosition={PINTEREST_PANEL_DEFAULT_POSITION}
			isOpen={isOpen}
			onClose={onClose}
			panelStyle={{ minWidth: '220px', maxWidth: '280px' }}
		>
			<div className='p-3 space-y-3'>
				{error && (
					<div className='text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 flex items-start gap-1.5'>
						<span className='flex-1'>{error}</span>
						<button type='button' onClick={clearError} className='text-red-400 hover:text-red-600'>
							<Icon name='close' size='sm' />
						</button>
					</div>
				)}

				{!isAuthenticated ? (
					/* ── Not authenticated ─────────────────────────────── */
					<div className='space-y-2'>
						<p className='text-xs text-slate-500 leading-relaxed'>
							Connect your Pinterest account to save edited images directly to your boards.
						</p>
						<PillButton
							onClick={initiateAuth}
							disabled={isLoading}
							className='w-full flex items-center justify-center gap-1.5'
						>
							<Icon name='pinterest' size='sm' />
							{isLoading ? 'Checking...' : 'Connect Pinterest'}
						</PillButton>
					</div>
				) : (
					/* ── Authenticated ────────────────────────────────── */
					<div className='space-y-3'>
						{/* Boards section */}
						<div className='space-y-1.5'>
							<div className='flex items-center justify-between'>
								<SectionHeader>Your Boards</SectionHeader>
								<button
									type='button'
									onClick={fetchBoards}
									disabled={isLoading}
									className='text-[10px] text-slate-400 hover:text-slate-600 disabled:opacity-40'
									title='Refresh boards'
								>
									↻
								</button>
							</div>

							{isLoading && boards.length === 0 ? (
								<p className='text-xs text-slate-400 py-2 text-center'>Loading boards…</p>
							) : boards.length === 0 ? (
								<p className='text-xs text-slate-400 py-2 text-center'>No boards found</p>
							) : (
								<div className='max-h-48 overflow-y-auto space-y-0.5'>
									{boards.map((board) => (
										<BoardItem
											key={board.id}
											board={board}
											isSelected={selectedBoardId === board.id}
											onSelect={selectBoard}
										/>
									))}
								</div>
							)}
						</div>

						<div className='border-t border-slate-100' />

						{/* Save action */}
						<div className='space-y-1.5'>
							<SectionHeader>Save to Pinterest</SectionHeader>
							<button
								type='button'
								onClick={handleSaveToBoard}
								disabled={!hasImage || !selectedBoardId || saveStatus === 'saving'}
								className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
									saveStatus === 'saved'
										? 'bg-green-500 text-white'
										: saveStatus === 'error'
											? 'bg-red-500 text-white'
											: 'bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
								}`}
							>
								<Icon name='pinterest' size='sm' />
								{saveStatus === 'saving'
									? 'Saving…'
									: saveStatus === 'saved'
										? 'Saved!'
										: saveStatus === 'error'
											? 'Failed'
											: 'Save as Pin'}
							</button>
							{!selectedBoardId && isAuthenticated && (
								<p className='text-[10px] text-slate-400 text-center'>Select a board above</p>
							)}
						</div>

						<div className='border-t border-slate-100' />

						{/* Account */}
						<div>
							<button
								type='button'
								onClick={logout}
								className='text-xs text-slate-400 hover:text-slate-600 transition-colors'
							>
								Disconnect Pinterest
							</button>
						</div>
					</div>
				)}
			</div>
		</FloatingWidget>
	);
};

export default PinterestPanel;
