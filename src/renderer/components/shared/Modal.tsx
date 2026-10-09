import type React from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
	children: ReactNode;
	/** Width class for the card. */
	widthClass?: string;
}

/**
 * Backdrop + card shell shared by the app's dialogs.
 *
 * Was repeated four times; the Edit Tags copy had a malformed `z-300]` class that
 * silently swallowed `flex`, so this keeps one definition.
 */
const Modal: React.FC<ModalProps> = ({ children, widthClass = 'w-[360px]' }) => (
	<div className='fixed inset-0 z-[300] flex items-center justify-center bg-black/40'>
		<div className={`bg-white rounded-xl shadow-2xl p-5 ${widthClass}`}>{children}</div>
	</div>
);

export default Modal;
