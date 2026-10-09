import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Modal from '../../../src/renderer/components/shared/Modal';

describe('Modal', () => {
	it('marks the card as a modal dialog', () => {
		render(<Modal>body</Modal>);

		const dialog = screen.getByRole('dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
	});

	it('hides the backdrop from assistive technology without hiding the dialog', () => {
		render(<Modal>body</Modal>);

		// The backdrop is presentational; dismissal is handled by useDismissable.
		// It must be a sibling of the card, since `aria-hidden` hides a subtree —
		// wrapping the dialog in it would hide the dialog too.
		const backdrop = document.querySelector('[aria-hidden="true"]');
		expect(backdrop).toBeTruthy();
		expect(backdrop?.contains(screen.getByRole('dialog'))).toBe(false);
	});

	it('names the dialog from its visible heading', () => {
		render(<Modal title='Rename Folder'>body</Modal>);

		// The accessible name must come from the heading, so the dialog is named
		// without the caller repeating the string in a hidden element.
		expect(screen.getByRole('dialog', { name: 'Rename Folder' })).toBeDefined();
	});

	it('renders the title as a visible heading, not a hidden duplicate', () => {
		render(<Modal title='Save to folder'>body</Modal>);

		const heading = screen.getByRole('heading', { level: 2, name: 'Save to folder' });
		expect(heading.className).not.toContain('sr-only');
	});

	it('points aria-labelledby at the rendered heading', () => {
		render(<Modal title='Edit Tags — Refs'>body</Modal>);

		const dialog = screen.getByRole('dialog');
		const labelledBy = dialog.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();
		expect(document.getElementById(labelledBy as string)?.textContent).toBe('Edit Tags — Refs');
	});

	it('prefers an explicit aria-label over the heading', () => {
		render(
			<Modal title='Delete "Refs"?' ariaLabel='Confirm folder deletion'>
				body
			</Modal>,
		);

		const dialog = screen.getByRole('dialog');
		expect(dialog.getAttribute('aria-label')).toBe('Confirm folder deletion');
		expect(dialog.getAttribute('aria-labelledby')).toBeNull();
	});

	it('renders no heading when no title is given', () => {
		render(<Modal>body</Modal>);

		expect(screen.queryByRole('heading')).toBeNull();
	});

	it('gives each instance a distinct heading id', () => {
		render(
			<>
				<Modal title='First'>a</Modal>
				<Modal title='Second'>b</Modal>
			</>,
		);

		const ids = screen.getAllByRole('dialog').map((d) => d.getAttribute('aria-labelledby'));
		expect(ids[0]).not.toBe(ids[1]);
	});

	it('applies the width class to the single card', () => {
		render(<Modal widthClass='w-[280px] space-y-3'>body</Modal>);

		// The card class list must contain the width exactly once — a second copy
		// was what made the folder picker narrower than its siblings.
		const card = screen.getByRole('dialog');
		expect(card.className.match(/w-\[280px\]/g)).toHaveLength(1);
		expect(card.className).toContain('space-y-3');
	});

	it('renders its children inside the card', () => {
		render(<Modal title='T'>the content</Modal>);

		expect(screen.getByRole('dialog').textContent).toContain('the content');
	});
});
