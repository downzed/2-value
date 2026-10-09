import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogButton } from '../../../src/renderer/components/shared/DialogButton';

describe('DialogButton', () => {
	it('defaults to a plain button so it cannot post a stray form', () => {
		render(<DialogButton onClick={vi.fn()}>Save</DialogButton>);

		expect(screen.getByRole('button').getAttribute('type')).toBe('button');
	});

	it('submit variant posts the enclosing form', () => {
		render(<DialogButton variant='submit'>Rename</DialogButton>);

		expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
	});

	it('calls onClick', () => {
		const onClick = vi.fn();
		render(<DialogButton onClick={onClick}>Cancel</DialogButton>);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('does not require an onClick, since submit buttons post the form instead', () => {
		expect(() => render(<DialogButton variant='submit'>Save</DialogButton>)).not.toThrow();
	});

	it('paints each variant differently', () => {
		const { rerender } = render(<DialogButton onClick={vi.fn()}>Save</DialogButton>);
		const primary = screen.getByRole('button').className;

		rerender(
			<DialogButton variant='danger' onClick={vi.fn()}>
				Delete
			</DialogButton>,
		);
		const danger = screen.getByRole('button').className;

		rerender(
			<DialogButton variant='ghost' onClick={vi.fn()}>
				Cancel
			</DialogButton>,
		);
		const ghost = screen.getByRole('button').className;

		expect(primary).toContain('bg-slate-800');
		expect(danger).toContain('bg-red-500');
		expect(ghost).toContain('text-slate-600');
		expect(primary).not.toBe(ghost);
	});

	it('does not fire while disabled', () => {
		const onClick = vi.fn();
		render(
			<DialogButton onClick={onClick} disabled>
				Save
			</DialogButton>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).not.toHaveBeenCalled();
	});

	it('keeps its base classes when given extras', () => {
		render(
			<DialogButton onClick={vi.fn()} className='flex-1'>
				Save
			</DialogButton>,
		);

		const button = screen.getByRole('button');
		expect(button.className).toContain('flex-1');
		expect(button.className).toContain('rounded-lg');
	});
});
