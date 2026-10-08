import { useEffect, useMemo } from 'react';
import { ImageProcessor } from '../core/ImageProcessor';
import type { ProcessParams, ProcessResult } from '../core/ImageProcessor';

export type { ProcessParams, ProcessResult };

/**
 * React binding for {@link ImageProcessor}.
 *
 * The worker has a real lifecycle, so this hook owns `start()`/`dispose()` for
 * the lifetime of the component. Each instance gets its own worker, which is why
 * exporting an item uses its own processor rather than the preview's.
 */
export function useImageProcessingWorker() {
	const processor = useMemo(() => new ImageProcessor(), []);

	useEffect(() => {
		processor.start();
		return () => processor.dispose();
	}, [processor]);

	return { process: processor.process };
}
