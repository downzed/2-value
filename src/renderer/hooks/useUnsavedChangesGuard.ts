import { useEffect } from 'react';
import { useImageContext } from './ImageContext';

/**
 * Warns before the page unloads while any open item has unsaved changes.
 *
 * Browsers ignore the custom message and show their own generic dialog, so the
 * return value of preventDefault() is all that matters here.
 */
export function useUnsavedChangesGuard() {
	const { hasDirtyItems } = useImageContext();

	useEffect(() => {
		if (!hasDirtyItems) return;
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			// Legacy browsers need returnValue set to trigger the prompt.
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [hasDirtyItems]);
}
