import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconToggle } from '../../../src/renderer/components/shared/IconToggle';

describe('IconToggle', () => {
	it('exposes the title as both the accessible name and the tooltip', () => {
		render(
			<IconToggle active={false} onClick={vi.fn()} title='Gallery (Alt+4)'>
				<span>icon</span>
			</IconToggle>,
		);

		const button = screen.getByRole('button', { name: 'Gallery (Alt+4)' });
		expect(button.getAttribute('title')).toBe('Gallery (Alt+4)');
	});

	it('reflects the active state through aria-pressed', () => {
		const { rerender } = render(
			<IconToggle active={false} onClick={vi.fn()} title='Gallery'>
				<span>icon</span>
			</IconToggle>,
		);
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');

		rerender(
			<IconToggle active onClick={vi.fn()} title='Gallery'>
				<span>icon</span>
			</IconToggle>,
		);
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
	});

	it('calls onClick when pressed', () => {
		const onClick = vi.fn();
		render(
			<IconToggle active={false} onClick={onClick} title='Gallery'>
				<span>icon</span>
			</IconToggle>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('styles the active and inactive states differently', () => {
		const { rerender } = render(
			<IconToggle active={false} onClick={vi.fn()} title='Gallery'>
				<span>icon</span>
			</IconToggle>,
		);
		const inactive = screen.getByRole('button').className;

		rerender(
			<IconToggle active onClick={vi.fn()} title='Gallery'>
				<span>icon</span>
			</IconToggle>,
		);
		const active = screen.getByRole('button').className;

		expect(active).not.toBe(inactive);
		expect(active).toContain('bg-slate-700');
	});

	it('positions itself for a badge only when one is present', () => {
		const { rerender } = render(
			<IconToggle active={false} onClick={vi.fn()} title='Timer'>
				<span>icon</span>
			</IconToggle>,
		);
		expect(screen.getByRole('button').className).not.toContain('relative');

		rerender(
			<IconToggle active={false} onClick={vi.fn()} title='Timer' badge={<span>30</span>}>
				<span>icon</span>
			</IconToggle>,
		);
		expect(screen.getByRole('button').className).toContain('relative');
	});

	it('renders the badge alongside the icon', () => {
		render(
			<IconToggle active onClick={vi.fn()} title='Timer' badge={<span>30</span>}>
				<span>icon</span>
			</IconToggle>,
		);

		const button = screen.getByRole('button', { name: 'Timer' });
		expect(button.textContent).toContain('30');
		expect(button.textContent).toContain('icon');
	});

	it('appends extra classes without dropping the base ones', () => {
		render(
			<IconToggle active={false} onClick={vi.fn()} title='Gallery' className='mr-2'>
				<span>icon</span>
			</IconToggle>,
		);

		const button = screen.getByRole('button');
		expect(button.className).toContain('mr-2');
		expect(button.className).toContain('w-6');
	});
});
