import type React from 'react';
import { Button } from './Button';

interface DialogButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	/**
	 * `primary` for the confirming action, `ghost` for Cancel-style dismissal,
	 * `danger` for a destructive confirmation. `submit` posts the enclosing form.
	 */
	variant?: 'primary' | 'ghost' | 'danger' | 'submit';
	disabled?: boolean;
	className?: string;
}

const VARIANTS = {
	primary: 'bg-slate-800 text-white hover:bg-slate-700',
	danger: 'bg-red-500 text-white hover:bg-red-600',
	ghost: 'text-slate-600 hover:text-slate-800',
	submit: 'bg-slate-800 text-white hover:bg-slate-700',
} as const;

/**
 * A dialog's footer button.
 *
 * Every modal in the app ends with a Cancel/Save pair built from the same two
 * class strings; only the accent differs (slate for confirm, red for delete).
 * `submit` exists because the rename and tags dialogs post a `<form>`, where a
 * `type='button'` would silently do nothing.
 */
export const DialogButton: React.FC<DialogButtonProps> = ({
	children,
	onClick,
	variant = 'primary',
	disabled,
	className,
}) => (
	<Button
		type={variant === 'submit' ? 'submit' : 'button'}
		onClick={onClick}
		disabled={disabled}
		className={`px-3 py-1.5 text-xs rounded-lg disabled:hover:bg-transparent ${VARIANTS[variant]} ${className ?? ''}`}
	>
		{children}
	</Button>
);
