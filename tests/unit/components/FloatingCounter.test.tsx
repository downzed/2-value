import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FloatingCounter from '../../../src/renderer/components/FloatingCounter';
import { createMockContextValue } from '../../helpers/mocks';

vi.mock('../../../src/renderer/hooks/ImageContext', () => ({
	useImageContext: vi.fn(),
}));

// FloatingWidget uses useDraggablePanel which uses localStorage (already mocked in setup.ts)

import { useImageContext } from '../../../src/renderer/hooks/ImageContext';

describe('FloatingCounter', () => {
	beforeEach(() => {
		vi.mocked(useImageContext).mockReturnValue(createMockContextValue() as ReturnType<typeof useImageContext>);
	});

	it('renders preset buttons (1m, 5m, 10m, 15m)', () => {
		render(<FloatingCounter />);
		expect(screen.getByText('1m')).toBeDefined();
		expect(screen.getByText('5m')).toBeDefined();
		expect(screen.getByText('10m')).toBeDefined();
		expect(screen.getByText('15m')).toBeDefined();
	});

	it('renders nothing when panels.timer is false', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({
				panels: { controls: true, original: true, timer: false, gallery: false },
			}) as ReturnType<typeof useImageContext>,
		);
		const { container } = render(<FloatingCounter />);
		expect(container.firstChild).toBeNull();
	});

	it('clicking a preset calls startCounter with the correct duration', async () => {
		const startCounter = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ startCounter }) as ReturnType<typeof useImageContext>,
		);
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('5m'));
		expect(startCounter).toHaveBeenCalledWith(300);
	});

	it('displays countdown in MM:SS format for durations >= 1 minute', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 125, counterRunning: true, counterDuration: 300 }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		expect(screen.getByText('2:05')).toBeDefined();
	});

	it('displays countdown in seconds for durations < 1 minute', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 42, counterRunning: true, counterDuration: 60 }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		expect(screen.getByText('42')).toBeDefined();
	});

	it('shows Stop button when timer is running', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 60, counterRunning: true, counterDuration: 60 }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		expect(screen.getByText('Stop')).toBeDefined();
	});

	it('shows Start button when timer is not running', () => {
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 0, counterRunning: false, counterDuration: 60 }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		expect(screen.getByText('Start')).toBeDefined();
	});

	it('Reset button calls stopCounter', async () => {
		const stopCounter = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 30, counterRunning: true, counterDuration: 60, stopCounter }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('Reset'));
		expect(stopCounter).toHaveBeenCalled();
	});

	it('Start/Stop button toggles: Stop calls stopCounter', async () => {
		const stopCounter = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 60, counterRunning: true, counterDuration: 60, stopCounter }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('Stop'));
		expect(stopCounter).toHaveBeenCalled();
	});

	it('Start button calls startCounter with counterDuration when not running', async () => {
		const startCounter = vi.fn();
		vi.mocked(useImageContext).mockReturnValue(
			createMockContextValue({ counter: 0, counterRunning: false, counterDuration: 300, startCounter }) as ReturnType<
				typeof useImageContext
			>,
		);
		render(<FloatingCounter />);
		fireEvent.click(screen.getByText('Start'));
		expect(startCounter).toHaveBeenCalledWith(300);
	});
});
