export const UI = {
	FILTER: {
		BLUR_MIN: 0,
		BLUR_MAX: 10,
		BLUR_STEP: 0.5,
		THRESHOLD_MIN: 0,
		THRESHOLD_MAX: 255,
		THRESHOLD_STEP: 1,
		THREE_ZONE_BOUNDARY: 40,
	},
	PRESETS: [
		{ name: 'Sketch', blur: 1.5, threshold: 128, values: 2 as const },
		{ name: 'High Contrast', blur: 0, threshold: 100, values: 2 as const },
		{ name: '3-Tone', blur: 2.0, threshold: 128, values: 3 as const },
	],
	ZOOM: {
		MIN: 0.25,
		MAX: 4,
		STEP: 0.25,
		WHEEL_STEP: 0.1,
		FIT_MAX: 1,
	},
	HISTORY: {
		MAX_DEPTH: 50,
	},
	PERF: {
		MAX_FILE_BYTES: 25 * 1024 * 1024, // hard stop (25MB input file)
		MAX_PIXELS: 40_000_000, // hard stop (e.g. 8k x 5k)
		PREVIEW_MAX_PIXELS: 2_000_000, // interactive preview target
		INTERACTIVE_DEBOUNCE_MS: 120,
	},
};
