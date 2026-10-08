import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessor } from '../../../src/renderer/core/ImageProcessor';
import type { ProcessParams } from '../../../src/renderer/core/ImageProcessor';

const params: ProcessParams = { blur: 0, threshold: 0, values: 2 };

function makeImage(width = 4, height = 4) {
	return {
		width,
		height,
		getRawImage: () => ({ data: new Uint8Array(width * height * 4), width, height, colorModel: 'RGBA' }),
	} as never;
}

/** Minimal Worker stand-in; each instance records what was posted. */
class FakeWorker {
	static instances: FakeWorker[] = [];
	onmessage: ((e: { data: unknown }) => void) | null = null;
	onerror: (() => void) | null = null;
	posted: unknown[] = [];
	terminated = false;

	constructor() {
		FakeWorker.instances.push(this);
	}

	postMessage(msg: unknown) {
		this.posted.push(msg);
	}

	terminate() {
		this.terminated = true;
	}

	respond(payload: { data: Uint8Array; width: number; height: number }) {
		this.onmessage?.({
			data: { jobId: (this.posted[0] as { jobId: number }).jobId, ...payload },
		});
	}
}

describe('ImageProcessor', () => {
	beforeEach(() => {
		FakeWorker.instances = [];
		vi.stubGlobal('Worker', FakeWorker as never);
		vi.stubGlobal(
			'ImageData',
			class {
				constructor(
					public data: Uint8ClampedArray,
					public width: number,
					public height: number,
				) {}
			} as never,
		);
	});

	it('does not create a worker until started', () => {
		const processor = new ImageProcessor();
		expect(FakeWorker.instances).toHaveLength(0);

		processor.start();
		expect(FakeWorker.instances).toHaveLength(1);
	});

	it('ignores a second start', () => {
		const processor = new ImageProcessor();
		processor.start();
		processor.start();
		expect(FakeWorker.instances).toHaveLength(1);
	});

	it('terminates the worker on dispose', () => {
		const processor = new ImageProcessor();
		processor.start();
		const worker = FakeWorker.instances[0];

		processor.dispose();

		expect(worker.terminated).toBe(true);
	});

	it('falls back to synchronous results when no worker is running', () => {
		const processor = new ImageProcessor();
		const callback = vi.fn();

		processor.process(makeImage(), params, false, callback);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback.mock.calls[0][0].ok).toBe(true);
	});

	it('posts a job with the filter parameters', () => {
		const processor = new ImageProcessor();
		processor.start();
		const worker = FakeWorker.instances[0];

		processor.process(makeImage(), { blur: 2, threshold: 50, values: 3 }, false, vi.fn());

		const msg = worker.posted[0] as Record<string, unknown>;
		expect(msg.blur).toBe(2);
		expect(msg.threshold).toBe(50);
		expect(msg.values).toBe(3);
	});

	it('delivers the worker response to the callback', () => {
		const processor = new ImageProcessor();
		processor.start();
		const callback = vi.fn();

		processor.process(makeImage(), params, false, callback);
		FakeWorker.instances[0].respond({ data: new Uint8Array(64), width: 4, height: 4 });

		expect(callback).toHaveBeenCalledTimes(1);
		const result = callback.mock.calls[0][0];
		expect(result.ok).toBe(true);
		expect(result.imageData.width).toBe(4);
	});

	it('ignores a stale response after a newer job superseded it', () => {
		const processor = new ImageProcessor();
		processor.start();
		const first = vi.fn();
		const second = vi.fn();

		processor.process(makeImage(), params, false, first);
		processor.process(makeImage(), params, false, second);

		const worker = FakeWorker.instances[0];
		const firstJobId = (worker.posted[0] as { jobId: number }).jobId;

		// The superseded job's response arrives late.
		worker.onmessage?.({
			data: { jobId: firstJobId, data: new Uint8Array(64), width: 4, height: 4 },
		});

		expect(first).not.toHaveBeenCalled();
	});

	it('does not deliver a response after its job was cancelled', () => {
		const processor = new ImageProcessor();
		processor.start();
		const callback = vi.fn();

		const cancel = processor.process(makeImage(), params, false, callback);
		const jobId = (FakeWorker.instances[0].posted[0] as { jobId: number }).jobId;
		cancel();

		FakeWorker.instances[0].onmessage?.({
			data: { jobId, data: new Uint8Array(64), width: 4, height: 4 },
		});

		expect(callback).not.toHaveBeenCalled();
	});

	it('fails every pending job when the worker errors', () => {
		const processor = new ImageProcessor();
		processor.start();
		const first = vi.fn();
		const second = vi.fn();

		processor.process(makeImage(), params, false, first);
		processor.process(makeImage(), params, false, second);

		FakeWorker.instances[0].onerror?.();

		expect(second).toHaveBeenCalledWith({ ok: false });
		expect(first).not.toHaveBeenCalled();
	});

	it('drops pending jobs on dispose', () => {
		const processor = new ImageProcessor();
		processor.start();
		const callback = vi.fn();

		processor.process(makeImage(), params, false, callback);
		processor.dispose();

		FakeWorker.instances[0].onmessage?.({
			data: { jobId: 1, data: new Uint8Array(64), width: 4, height: 4 },
		});

		expect(callback).not.toHaveBeenCalled();
	});
});
