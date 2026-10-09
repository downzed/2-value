import { useEffect, useRef, useState } from 'react';
import { useMenuPosition } from '../../react/useMenuPosition';

export interface FileMenuItem {
	id: string;
	label: string;
	shortcut?: string;
	/** Shown as a smaller second line. Only where the action needs explaining. */
	description?: string;
	disabled?: boolean;
	onSelect: () => void;
}

interface FileMenuProps {
	items: FileMenuItem[];
}

/**
 * "File" dropdown for the top bar.
 *
 * Shortcut hints are informational only — the key handling lives in BottomPanel,
 * so moving the buttons behind a menu does not change any binding.
 */
const FileMenu: React.FC<FileMenuProps> = ({ items }) => {
	const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	// Anchored to the trigger button and clamped, so the menu lines up under the
	// button without running off the bottom or right of the window. The rect is
	// read on click rather than during render, where it would be a layout read.
	const position = useMenuPosition(anchor?.left ?? 0, anchor?.bottom ?? 0, menuRef);

	const toggle = () => {
		setAnchor((prev) => {
			if (prev) return null;
			const rect = buttonRef.current?.getBoundingClientRect();
			return { left: rect?.left ?? 0, bottom: rect?.bottom ?? 0 };
		});
	};

	useEffect(() => {
		if (!anchor) return;
		const handleMouseDown = (e: MouseEvent) => {
			const target = e.target as Node;
			if (menuRef.current?.contains(target)) return;
			if (buttonRef.current?.contains(target)) return;
			setAnchor(null);
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setAnchor(null);
				buttonRef.current?.focus();
			}
		};
		document.addEventListener('mousedown', handleMouseDown);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [anchor]);

	const run = (item: FileMenuItem) => {
		if (item.disabled) return;
		setAnchor(null);
		item.onSelect();
	};

	return (
		<>
			<button
				ref={buttonRef}
				type='button'
				onClick={toggle}
				aria-haspopup='menu'
				aria-expanded={anchor !== null}
				className={`text-xs px-1 py-0.5 rounded transition-colors hover:bg-slate-700 ${
					anchor ? 'bg-slate-700 text-slate-100' : 'text-slate-300'
				}`}
			>
				File
			</button>

			{anchor && (
				<div
					ref={menuRef}
					role='menu'
					className='fixed z-[200] w-60 bg-white border border-slate-200 rounded-lg shadow-lg py-1'
					// Hidden until measured, so clamping to the viewport does not visibly jump.
					style={{
						left: position?.left ?? 0,
						top: position?.top ?? 0,
						visibility: position ? 'visible' : 'hidden',
					}}
				>
					{items.map((item) => (
						<button
							key={item.id}
							type='button'
							role='menuitem'
							disabled={item.disabled}
							onClick={() => run(item)}
							className='w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
						>
							<span className='flex items-baseline justify-between gap-3'>
								<span className='font-medium'>{item.label}</span>
								{item.shortcut && <span className='text-[10px] text-slate-400'>{item.shortcut}</span>}
							</span>
							{item.description && <span className='block text-[10px] text-slate-400 mt-0.5'>{item.description}</span>}
						</button>
					))}
				</div>
			)}
		</>
	);
};

export default FileMenu;
