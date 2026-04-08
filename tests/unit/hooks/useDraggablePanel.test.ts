import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDraggablePanel } from '../../../src/renderer/hooks/useDraggablePanel';

describe('useDraggablePanel', () => {
	const mockStorage: Record<string, string> = {};
	const originalGetItem = localStorage.getItem;
	const originalSetItem = localStorage.setItem;
	const originalRemoveItem = localStorage.removeItem;

	beforeEach(() => {
		localStorage.getItem = vi.fn((key: string) => mockStorage[key] ?? null);
		localStorage.setItem = vi.fn((key: string, value: string) => {
			mockStorage[key] = value;
		});
		localStorage.removeItem = vi.fn((key: string) => {
			delete mockStorage[key];
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.getItem = originalGetItem;
		localStorage.setItem = originalSetItem;
		localStorage.removeItem = originalRemoveItem;
		Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
	});

	it('should initialize with default position', () => {
		const panelRef = { current: null } as React.RefObject<HTMLDivElement>;
		const { result } = renderHook(() =>
			useDraggablePanel({
				storageKey: 'test-key',
				defaultPosition: { x: 20, y: 30 },
				panelRef,
			}),
		);

		expect(result.current.position).toEqual({ x: 20, y: 30 });
	});

	it('should return isDragging as false initially', () => {
		const panelRef = { current: null } as React.RefObject<HTMLDivElement>;
		const { result } = renderHook(() =>
			useDraggablePanel({
				storageKey: 'test-key',
				defaultPosition: { x: 20, y: 30 },
				panelRef,
			}),
		);

		expect(result.current.isDragging).toBe(false);
	});

	it('should provide handleMouseDown function', () => {
		const panelRef = { current: null } as React.RefObject<HTMLDivElement>;
		const { result } = renderHook(() =>
			useDraggablePanel({
				storageKey: 'test-key',
				defaultPosition: { x: 20, y: 30 },
				panelRef,
			}),
		);

		expect(typeof result.current.handleMouseDown).toBe('function');
	});
});
