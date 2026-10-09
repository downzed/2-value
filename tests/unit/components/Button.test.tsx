import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../src/renderer/components/shared/Button';

describe('Button', () => {
	it('defaults to type=button so it cannot post a stray form', () => {
		render(<Button>Save</Button>);

		expect(screen.getByRole('button').getAttribute('type')).toBe('button');
	});

	it('can post a form when asked', () => {
		render(<Button type='submit'>Rename</Button>);

		expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
	});

	it('omits aria-pressed entirely when not given', () => {
		render(<Button>Open</Button>);

		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBeNull();
	});

	it('reports false rather than omitting when pressed={false}', () => {
		render(<Button pressed={false}>A</Button>);

		expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
	});

	it('keeps label and title independent', () => {
		render(
			<Button label='Open photo' title='photo.jpg'>
				<span>◉</span>
			</Button>,
		);

		const button = screen.getByRole('button');
		expect(button.getAttribute('aria-label')).toBe('Open photo');
		expect(button.getAttribute('title')).toBe('photo.jpg');
	});

	it('adds no tooltip when only a label is given', () => {
		render(<Button label='Close'>x</Button>);

		expect(screen.getByRole('button').getAttribute('title')).toBeNull();
	});

	it('block lays out as a full-width left-aligned row', () => {
		render(<Button block>Open</Button>);
		const button = screen.getByRole('button');

		expect(button.className).toContain('w-full');
		expect(button.className).toContain('text-left');
	});

	it('always transitions', () => {
		render(<Button>Open</Button>);

		expect(screen.getByRole('button').className).toContain('transition-colors');
	});

	it('dims by default when disabled', () => {
		render(<Button disabled>Open</Button>);

		expect(screen.getByRole('button').className).toContain('disabled:opacity-40');
	});

	it('honours the faint and none disabled tones', () => {
		const { rerender } = render(
			<Button disabled disabledTone='faint'>
				Create
			</Button>,
		);
		expect(screen.getByRole('button').className).toContain('disabled:opacity-50');

		rerender(
			<Button disabled disabledTone='none'>
				Create
			</Button>,
		);
		expect(screen.getByRole('button').className).not.toContain('disabled:opacity-40');
	});

	it('appends className without leaving a stray space when empty', () => {
		render(<Button className=''>Open</Button>);

		expect(screen.getByRole('button').className.endsWith(' ')).toBe(false);
	});

	it('forwards both click and contextmenu events', () => {
		const onClick = vi.fn();
		const onContextMenu = vi.fn();
		render(
			<Button onClick={onClick} onContextMenu={onContextMenu}>
				Open
			</Button>,
		);

		fireEvent.click(screen.getByRole('button'), { clientX: 1 });
		fireEvent.contextMenu(screen.getByRole('button'));

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onContextMenu).toHaveBeenCalledTimes(1);
	});

	it('does not fire click while disabled', () => {
		const onClick = vi.fn();
		render(
			<Button onClick={onClick} disabled>
				Open
			</Button>,
		);

		fireEvent.click(screen.getByRole('button'));

		expect(onClick).not.toHaveBeenCalled();
	});

	it('passes menuitem role through', () => {
		render(
			<div role='menu'>
				<Button role='menuitem'>Open</Button>
			</div>,
		);

		expect(screen.getByRole('menuitem')).toBeDefined();
	});
});
