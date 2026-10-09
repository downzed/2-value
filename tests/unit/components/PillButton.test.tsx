import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PillButton } from '../../../src/renderer/components/shared/PillButton';

describe('PillButton', () => {
	it('renders its label and calls onClick', () => {
		const onClick = vi.fn();
		render(<PillButton onClick={onClick}>Sketch</PillButton>);

		fireEvent.click(screen.getByRole('button', { name: 'Sketch' }));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('uses the neutral fill by default', () => {
		render(<PillButton onClick={vi.fn()}>Sketch</PillButton>);

		expect(screen.getByRole('button').className).toContain('bg-slate-100');
	});

	it('inverts when active', () => {
		render(
			<PillButton active onClick={vi.fn()}>
				Sketch
			</PillButton>,
		);

		expect(screen.getByRole('button').className).toContain('bg-slate-700');
	});

	it('reports pressed state for the neutral tone only', () => {
		render(
			<PillButton active onClick={vi.fn()}>
				Sketch
			</PillButton>,
		);
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
	});

	it('paints solid accents and does not pretend to be a toggle', () => {
		const { rerender } = render(
			<PillButton tone='success' onClick={vi.fn()}>
				Start
			</PillButton>,
		);
		expect(screen.getByRole('button').className).toContain('bg-emerald-500');
		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBeNull();

		rerender(
			<PillButton tone='danger' onClick={vi.fn()}>
				Stop
			</PillButton>,
		);
		expect(screen.getByRole('button').className).toContain('bg-red-500');
	});

	it('ignores active for solid accents, which have no off state', () => {
		const { rerender } = render(
			<PillButton tone='success' onClick={vi.fn()}>
				Start
			</PillButton>,
		);
		const off = screen.getByRole('button').className;

		rerender(
			<PillButton tone='success' active onClick={vi.fn()}>
				Start
			</PillButton>,
		);

		expect(screen.getByRole('button').className).toBe(off);
	});

	it('md size is wider than sm', () => {
		render(
			<PillButton size='md' onClick={vi.fn()}>
				Reset
			</PillButton>,
		);
		expect(screen.getByRole('button').className).toContain('px-3');
	});

	it('does not fire while disabled', () => {
		const onClick = vi.fn();
		render(
			<PillButton onClick={onClick} disabled>
				Sketch
			</PillButton>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).not.toHaveBeenCalled();
	});
});
