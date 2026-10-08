import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeErrorMessage, decodeImageFile } from '../../../src/renderer/core/decode';
import { UI } from '../../../src/renderer/constants/ui';

function makeFile(size: number, name = 'a.png'): File {
	const file = new File([new Uint8Array(size)], name, { type: 'image/png' });
	// jsdom derives `size` from the content, so override it for limit tests.
	Object.defineProperty(file, 'size', { value: size });
	return file;
}

describe('decodeImageFile', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('rejects a file over the byte limit without decoding it', async () => {
		const result = await decodeImageFile(makeFile(UI.PERF.MAX_FILE_BYTES + 1));

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.error.code).toBe('FILE_TOO_LARGE');
		if (result.error.code !== 'FILE_TOO_LARGE') throw new Error('wrong code');
		expect(result.error.maxBytes).toBe(UI.PERF.MAX_FILE_BYTES);
	});

	it('reports a decode failure rather than throwing', async () => {
		const file = new File(['not an image'], 'broken.png', { type: 'image/png' });

		const result = await decodeImageFile(file);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('expected failure');
		expect(result.error.code).toBe('DECODE_FAILED');
	});

	describe('decodeErrorMessage', () => {
		it('explains the byte limit in MB', () => {
			const msg = decodeErrorMessage({
				code: 'FILE_TOO_LARGE',
				fileSize: 30_000_000,
				maxBytes: 25 * 1024 * 1024,
			});
			expect(msg).toContain('25 MB');
		});

		it('explains the pixel limit', () => {
			const msg = decodeErrorMessage({
				code: 'TOO_MANY_PIXELS',
				pixels: 50_000_000,
				maxPixels: 40_000_000,
			});
			expect(msg).toContain('too large');
		});

		it('explains a decode failure', () => {
			expect(decodeErrorMessage({ code: 'DECODE_FAILED', cause: new Error('bad') })).toContain('decode');
		});
	});
});
