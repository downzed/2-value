import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDraggablePanel } from '../../../src/renderer/hooks/useDraggablePanel';

describe('useDraggablePanel', () => {
	let mockStorage: Record<string, string>;

	beforeEach(() => {
		mockStorage = {};
		vi.spyOn(localStorage, 'getItem').mockImplementation((key: string) => mockStorage[key] ?? null);
		vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
			mockStorage[key] = value;
		});
		vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
			delete mockStorage[key];
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should initialize with default position', () => {
		const panelRef = {
			current: null,
		} as unknown as React.RefObject<HTMLDivElement>;
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
		const panelRef = {
			current: null,
		} as unknown as React.RefObject<HTMLDivElement>;
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
		const panelRef = {
			current: null,
		} as unknown as React.RefObject<HTMLDivElement>;
		const { result } = renderHook(() =>
			useDraggablePanel({
				storageKey: 'test-key',
				defaultPosition: { x: 20, y: 30 },
				panelRef,
			}),
		);

		expect(typeof result.current.handleMouseDown).toBe('function');
	});

	describe('viewport clamping', () => {
		const VIEWPORT_W = 1024;
		const VIEWPORT_H = 768;
		const PANEL_W = 200;
		const PANEL_H = 100;

		function makePanel(left: number, top: number) {
			return {
				current: {
					getBoundingClientRect: () => ({ left, top }),
					offsetWidth: PANEL_W,
					offsetHeight: PANEL_H,
				},
			} as unknown as React.RefObject<HTMLDivElement>;
		}

		beforeEach(() => {
			Object.defineProperty(window, 'innerWidth', {
				value: VIEWPORT_W,
				writable: true,
				configurable: true,
			});
			Object.defineProperty(window, 'innerHeight', {
				value: VIEWPORT_H,
				writable: true,
				configurable: true,
			});
		});

		it('clamps position to the right viewport edge', () => {
			const panelRef = makePanel(500, 300);
			const { result } = renderHook(() =>
				useDraggablePanel({
					storageKey: 'clamp-right',
					defaultPosition: { x: 500, y: 300 },
					panelRef,
				}),
			);

			// Drag offset: clientX(510) - rect.left(500) = 10
			act(() => {
				result.current.handleMouseDown({
					clientX: 510,
					clientY: 310,
				} as React.MouseEvent);
			});

			// Mouse far to the right: x = 1200 - 10 = 1190, clamped to 1024 - 200 = 824
			act(() => {
				window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1200, clientY: 310 }));
			});

			expect(result.current.position.x).toBe(VIEWPORT_W - PANEL_W); // 824
		});

		it('clamps position to the bottom viewport edge', () => {
			const panelRef = makePanel(100, 300);
			const { result } = renderHook(() =>
				useDraggablePanel({
					storageKey: 'clamp-bottom',
					defaultPosition: { x: 100, y: 300 },
					panelRef,
				}),
			);

			// Drag offset: clientY(310) - rect.top(300) = 10
			act(() => {
				result.current.handleMouseDown({
					clientX: 110,
					clientY: 310,
				} as React.MouseEvent);
			});

			// Mouse far below: y = 900 - 10 = 890, clamped to 768 - 100 = 668
			act(() => {
				window.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 900 }));
			});

			expect(result.current.position.y).toBe(VIEWPORT_H - PANEL_H); // 668
		});

		it('clamps position to the left/top edge (never below 0)', () => {
			const panelRef = makePanel(100, 100);
			const { result } = renderHook(() =>
				useDraggablePanel({
					storageKey: 'clamp-origin',
					defaultPosition: { x: 100, y: 100 },
					panelRef,
				}),
			);

			// Drag offset: 10, 10
			act(() => {
				result.current.handleMouseDown({
					clientX: 110,
					clientY: 110,
				} as React.MouseEvent);
			});

			// Mouse far up-left: x = 2 - 10 = -8 → 0, y = 5 - 10 = -5 → 0
			act(() => {
				window.dispatchEvent(new MouseEvent('mousemove', { clientX: 2, clientY: 5 }));
			});

			expect(result.current.position.x).toBe(0);
			expect(result.current.position.y).toBe(0);
		});

		it('clamps to 0 when the panel is larger than the viewport', () => {
			const largePanel = {
				current: {
					getBoundingClientRect: () => ({ left: 0, top: 0 }),
					offsetWidth: 2000,
					offsetHeight: 2000,
				},
			} as unknown as React.RefObject<HTMLDivElement>;

			const { result } = renderHook(() =>
				useDraggablePanel({
					storageKey: 'clamp-large',
					defaultPosition: { x: 0, y: 0 },
					panelRef: largePanel,
				}),
			);

			act(() => {
				result.current.handleMouseDown({
					clientX: 0,
					clientY: 0,
				} as React.MouseEvent);
			});

			act(() => {
				window.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 400 }));
			});

			expect(result.current.position.x).toBe(0);
			expect(result.current.position.y).toBe(0);
		});
	});
});
