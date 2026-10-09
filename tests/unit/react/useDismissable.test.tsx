import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { useDismissable } from '../../../src/renderer/react/useDismissable';

/** Minimal harness: a dismissible panel plus a trigger button. */
function Harness({ ignoreRef, onDismiss = vi.fn() }: { ignoreRef?: boolean; onDismiss?: () => void }) {
	const panelRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	useDismissable(panelRef, onDismiss, { ignoreRef: ignoreRef ? triggerRef : undefined });
	return (
		<div>
			<button ref={triggerRef} type='button'>
				Trigger
			</button>
			<div ref={panelRef} data-testid='panel'>
				Panel
			</div>
		</div>
	);
}

describe('useDismissable', () => {
	it('dismisses on Escape', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('ignores other keys', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		fireEvent.keyDown(document, { key: 'Enter' });
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('dismisses on an outside mousedown', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		fireEvent.mouseDown(screen.getByText('Trigger'));
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('does not dismiss on a mousedown inside the panel', () => {
		const onDismiss = vi.fn();
		render(<Harness onDismiss={onDismiss} />);
		fireEvent.mouseDown(screen.getByTestId('panel'));
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('does not dismiss on the trigger when the trigger is ignored', () => {
		const onDismiss = vi.fn();
		render(<Harness ignoreRef onDismiss={onDismiss} />);
		fireEvent.mouseDown(screen.getByText('Trigger'));
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('returns focus to the dismiss target on Escape', () => {
		function FocusTarget() {
			const panelRef = useRef<HTMLDivElement>(null);
			const buttonRef = useRef<HTMLButtonElement>(null);
			useDismissable(panelRef, () => {}, { refocusRef: buttonRef });
			return (
				<div>
					<div ref={panelRef} data-testid='panel'>
						Panel
					</div>
					<button ref={buttonRef} type='button'>
						Target
					</button>
				</div>
			);
		}
		render(<FocusTarget />);
		const target = screen.getByText('Target');
		target.focus();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(document.activeElement).toBe(target);
	});

	it('stops listening after unmount', () => {
		const onDismiss = vi.fn();
		const { unmount } = render(<Harness onDismiss={onDismiss} />);
		unmount();
		fireEvent.keyDown(document, { key: 'Escape' });
		fireEvent.mouseDown(document.body);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it('uses onBackdropClick instead of onClose when supplied', () => {
		function Backdrop() {
			const panelRef = useRef<HTMLDivElement>(null);
			const [count, setCount] = useState(0);
			useDismissable(panelRef, () => setCount((c) => c + 1), { onBackdropClick: () => setCount((c) => c + 10) });
			return (
				<div>
					<div ref={panelRef} data-testid='panel'>
						Panel
					</div>
					<span data-testid='count'>{count}</span>
				</div>
			);
		}
		render(<Backdrop />);
		fireEvent.mouseDown(document.body);
		expect(screen.getByTestId('count').textContent).toBe('10');
	});
});
