import { useCallback, useEffect, useRef } from 'react';

export function useDebouncedCallback<T extends unknown[]>(
	fn: (...args: T) => void,
	delay: number,
): (...args: T) => void {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fnRef = useRef(fn);

	useEffect(() => {
		fnRef.current = fn;
	});

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return useCallback(
		(...args: T) => {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => fnRef.current(...args), delay);
		},
		[delay],
	);
}
