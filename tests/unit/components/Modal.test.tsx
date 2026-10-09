import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('Modal focus management', () => {
	/** Renders a trigger plus the dialog, so there is something to restore to. */
	function TriggerAndModal() {
		const [open, setOpen] = useState(false);
		return (
			<>
				<button type='button' onClick={() => setOpen(true)}>
					Open dialog
				</button>
				{open && (
					<Modal title='Save to folder'>
						<button type='button'>Inside</button>
					</Modal>
				)}
			</>
		);
	}

	it('moves focus into the dialog on open', async () => {
		render(<TriggerAndModal />);
		screen.getByText('Open dialog').focus();

		fireEvent.click(screen.getByText('Open dialog'));

		expect(document.activeElement).toBe(screen.getByRole('dialog'));
	});

	it('restores focus when closed via its own button, not just on unmount', () => {
		function Closable() {
			const [open, setOpen] = useState(false);
			return (
				<>
					<button type='button' onClick={() => setOpen(true)}>
						Open dialog
					</button>
					{open && (
						<Modal title='T'>
							<button type='button' onClick={() => setOpen(false)}>
								Confirm
							</button>
						</Modal>
					)}
				</>
			);
		}
		render(<Closable />);
		const trigger = screen.getByText('Open dialog');
		trigger.focus();
		fireEvent.click(trigger);

		fireEvent.click(screen.getByText('Confirm'));

		expect(document.activeElement).toBe(trigger);
	});

	it('can focus a specific element instead of the card', () => {
		function WithInitialFocus() {
			const inputRef = useRef<HTMLInputElement>(null);
			return (
				<Modal title='Rename' initialFocusRef={inputRef}>
					<input ref={inputRef} aria-label='New name' />
				</Modal>
			);
		}
		render(<WithInitialFocus />);

		expect(document.activeElement).toBe(screen.getByLabelText('New name'));
	});

	it('does not restore focus to a trigger that has left the document', () => {
		// The menu row that opened the dialog may be unmounted by the time the
		// dialog closes; focus must not be moved to a detached node.
		const { unmount } = render(<TriggerAndModal />);
		const trigger = screen.getByText('Open dialog');
		trigger.focus();
		fireEvent.click(trigger);

		unmount();
		trigger.remove();

		expect(document.activeElement).not.toBe(trigger);
	});
});

describe('Modal focus trap', () => {
	/** A dialog with three controls, plus a control behind the backdrop. */
	function ThreeButtons() {
		return (
			<>
				<button type='button'>Behind the dialog</button>
				<Modal title='Rename'>
					<input aria-label='First' />
					<input aria-label='Second' />
					<button type='button'>Confirm</button>
				</Modal>
			</>
		);
	}

	/** Tab is not natively simulated by jsdom, so drive the handler directly. */
	function pressTab(target: Element, shiftKey = false) {
		const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
		target.dispatchEvent(event);
		return event;
	}

	it('wraps from the last control back to the first', () => {
		render(<ThreeButtons />);
		const confirm = screen.getByText('Confirm');
		confirm.focus();

		pressTab(confirm);

		expect(document.activeElement).toBe(screen.getByLabelText('First'));
	});

	it('wraps backwards from the first control to the last', () => {
		render(<ThreeButtons />);
		const first = screen.getByLabelText('First');
		first.focus();

		pressTab(first, true);

		expect(document.activeElement).toBe(screen.getByText('Confirm'));
	});

	it('steps forward normally between controls', () => {
		render(<ThreeButtons />);
		const first = screen.getByLabelText('First');
		first.focus();

		const event = pressTab(first);

		// Not a wrap point, so the browser's own tab handling is left alone.
		expect(event.defaultPrevented).toBe(false);
	});

	it('moves focus in when Tab arrives while the card itself has focus', () => {
		render(<ThreeButtons />);
		const card = screen.getByRole('dialog');
		card.focus();
		expect(document.activeElement).toBe(card);

		pressTab(card);

		// Focus was "before" the first control, so Tab steps in rather than wrapping.
		expect(event_defaultPreventedOf(card)).toBe(false);
	});

	it('keeps focus on the card when the dialog has no focusable children', () => {
		render(<Modal title='Empty'>nothing to focus</Modal>);
		const card = screen.getByRole('dialog');
		card.focus();

		pressTab(card);

		expect(document.activeElement).toBe(card);
	});

	it('never lets focus reach a control behind the dialog', () => {
		render(<ThreeButtons />);
		const behind = screen.getByText('Behind the dialog');
		behind.focus();

		// Even if focus were somehow outside, the trap keeps the cycle internal.
		pressTab(screen.getByText('Confirm'));

		expect(document.activeElement).not.toBe(behind);
	});

	it('skips disabled controls when cycling', () => {
		render(
			<Modal title='T'>
				<button type='button'>Only</button>
			</Modal>,
		);
		const only = screen.getByText('Only');
		only.focus();

		pressTab(only);

		expect(document.activeElement).toBe(only);
	});

	it('ignores keys other than Tab', () => {
		render(<ThreeButtons />);
		const confirm = screen.getByText('Confirm');
		confirm.focus();

		const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
		confirm.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(confirm);
	});
});

/** Helper kept out of the test body to keep the trap assertions readable. */
function event_defaultPreventedOf(el: Element): boolean {
	const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
	el.dispatchEvent(event);
	return event.defaultPrevented;
}
