import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';

interface Position {
	x: number;
	y: number;
}

interface UseDraggablePanelOptions {
	storageKey: string;
	defaultPosition: Position;
	panelRef: RefObject<HTMLDivElement | null>;
}

export function useDraggablePanel({ storageKey, defaultPosition, panelRef }: UseDraggablePanelOptions) {
	const [isDragging, setIsDragging] = useState(false);
	const [position, setPosition] = useState(defaultPosition);
	const dragOffset = useRef({ x: 0, y: 0 });
	const positionRef = useRef(defaultPosition);
	const panelDimsRef = useRef({ width: 0, height: 0 });

	useEffect(() => {
		try {
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				const parsed = JSON.parse(stored);
				setPosition(parsed);
			}
		} catch (e) {
			console.error('Failed to load position:', e);
		}
	}, [storageKey]);

	const savePosition = useCallback(
		(pos: Position) => {
			try {
				localStorage.setItem(storageKey, JSON.stringify(pos));
			} catch (e) {
				console.error('Failed to save position:', e);
			}
		},
		[storageKey],
	);

	const handleMouseDown = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			if (!panelRef.current) return;
			const rect = panelRef.current.getBoundingClientRect();
			panelDimsRef.current = {
				width: panelRef.current.offsetWidth,
				height: panelRef.current.offsetHeight,
			};
			dragOffset.current = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			};
			setIsDragging(true);
		},
		[panelRef],
	);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: globalThis.MouseEvent) => {
			const { width: panelWidth, height: panelHeight } = panelDimsRef.current;
			const newPos = {
				x: Math.max(0, Math.min(window.innerWidth - panelWidth, e.clientX - dragOffset.current.x)),
				y: Math.max(0, Math.min(window.innerHeight - panelHeight, e.clientY - dragOffset.current.y)),
			};
			positionRef.current = newPos;
			setPosition(newPos);
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			savePosition(positionRef.current);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isDragging, savePosition]);

	return {
		isDragging,
		position,
		handleMouseDown,
	};
}
