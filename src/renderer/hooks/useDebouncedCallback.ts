import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export function useDebouncedCallback<T extends unknown[]>(
	fn: (...args: T) => void,
	delay: number,
): { call: (...args: T) => void; cancel: () => void } {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fnRef = useRef(fn);

	useLayoutEffect(() => {
		fnRef.current = fn;
	}, [fn]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const cancel = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const call = useCallback(
		(...args: T) => {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => fnRef.current(...args), delay);
		},
		[delay],
	);

	return { call, cancel };
}
