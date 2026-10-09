import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '../../../src/renderer/components/shared/IconButton';

describe('IconButton', () => {
	it('uses the title as both accessible name and tooltip', () => {
		render(
			<IconButton onClick={vi.fn()} title='Close gallery'>
				<span>x</span>
			</IconButton>,
		);

		const button = screen.getByRole('button', { name: 'Close gallery' });
		expect(button.getAttribute('title')).toBe('Close gallery');
	});

	it('calls onClick when pressed', () => {
		const onClick = vi.fn();
		render(
			<IconButton onClick={onClick} title='Back to folders'>
				<span>←</span>
			</IconButton>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('forwards the click event so a menu can anchor to the pointer', () => {
		const onClick = vi.fn();
		render(
			<IconButton onClick={onClick} title='Actions'>
				<span>•••</span>
			</IconButton>,
		);

		fireEvent.click(screen.getByRole('button'), { clientX: 10, clientY: 20 });

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onClick.mock.calls[0][0]).toBeTruthy();
	});

	it('does not claim a pressed state for a plain icon button', () => {
		render(
			<IconButton onClick={vi.fn()} title='Close'>
				<span>x</span>
			</IconButton>,
		);

		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBeNull();
	});

	it('exposes pressed state only in the pressed tone', () => {
		const { rerender } = render(
			<IconButton tone='pressed' active onClick={vi.fn()} title='Show Original'>
				<span>◉</span>
			</IconButton>,
		);
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');

		rerender(
			<IconButton tone='pressed' active={false} onClick={vi.fn()} title='Show Original'>
				<span>◉</span>
			</IconButton>,
		);
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
	});

	it('highlights an active pressed toggle', () => {
		const { rerender } = render(
			<IconButton tone='pressed' active={false} onClick={vi.fn()} title='Eye'>
				<span>◉</span>
			</IconButton>,
		);
		const inactive = screen.getByRole('button').className;

		rerender(
			<IconButton tone='pressed' active onClick={vi.fn()} title='Eye'>
				<span>◉</span>
			</IconButton>,
		);

		expect(screen.getByRole('button').className).not.toBe(inactive);
	});

	it('uses a lighter hover on the dark status bar', () => {
		const { rerender } = render(
			<IconButton onClick={vi.fn()} title='Zoom In'>
				<span>+</span>
			</IconButton>,
		);
		const light = screen.getByRole('button').className;

		rerender(
			<IconButton surface='dark' onClick={vi.fn()} title='Zoom In'>
				<span>+</span>
			</IconButton>,
		);
		const dark = screen.getByRole('button').className;

		expect(light).toContain('hover:text-slate-600');
		expect(dark).toContain('hover:text-slate-200');
	});

	it('keeps base classes when given extras, e.g. for absolute positioning', () => {
		render(
			<IconButton onClick={vi.fn()} title='Clear search' className='absolute right-2 top-1/2'>
				<span>×</span>
			</IconButton>,
		);

		const button = screen.getByRole('button');
		expect(button.className).toContain('absolute');
		expect(button.className).toContain('transition-colors');
	});

	it('does not fire while disabled', () => {
		const onClick = vi.fn();
		render(
			<IconButton onClick={onClick} title='Close' disabled>
				<span>x</span>
			</IconButton>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).not.toHaveBeenCalled();
	});
});
