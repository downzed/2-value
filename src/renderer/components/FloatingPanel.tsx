import { useRef } from 'react';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import { Icon } from './shared/Icon';

interface FloatingPanelProps {
	/** Panel title displayed in the drag handle */
	title: string;
	/** localStorage key for position persistence */
	storageKey: string;
	/** Default position when no saved position exists */
	defaultPosition: { x: number; y: number };
	/** Whether the panel is open (controlled by parent via context) */
	isOpen: boolean;
	/** Called when user clicks close */
	onClose: () => void;
	/** Extra buttons in the title bar, rendered before the close button */
	titleBarActions?: React.ReactNode;
	/** Inline style overrides for the panel container (width, minWidth, etc.) */
	panelStyle?: React.CSSProperties;
	/** z-index class. Default: 'z-50' */
	zClass?: string;
	/** Panel body content - NO default padding, consumer controls it */
	children: React.ReactNode;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({
	title,
	storageKey,
	defaultPosition,
	isOpen,
	onClose,
	titleBarActions,
	panelStyle,
	zClass = 'z-50',
	children,
}) => {
	const panelRef = useRef<HTMLDivElement>(null);

	const { isDragging, position, handleMouseDown } = useDraggablePanel({
		storageKey,
		defaultPosition,
		panelRef,
	});

	if (!isOpen) return null;

	return (
		<div
			ref={panelRef}
			className={`fixed bg-white rounded-lg shadow-xl border border-slate-200 ${zClass} select-none`}
			style={{
				left: position.x,
				top: position.y,
				cursor: isDragging ? 'grabbing' : 'default',
				...panelStyle,
			}}
		>
			<div
				role='toolbar'
				onMouseDown={handleMouseDown}
				className='flex items-center justify-between px-3 py-2 border-b border-slate-100 cursor-grab active:cursor-grabbing'
			>
				<div className='flex items-center gap-2'>
					<span className='text-slate-400'>⋮⋮</span>
					<span className='text-xs font-semibold text-slate-700'>{title}</span>
				</div>
				<div className='flex items-center gap-2'>
					{titleBarActions}
					<button type='button' onClick={onClose} className='text-slate-400 hover:text-slate-600 transition-colors'>
						<Icon name='close' />
					</button>
				</div>
			</div>
			{children}
		</div>
	);
};

export default FloatingPanel;
