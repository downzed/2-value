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
	HISTORY: {
		MAX_DEPTH: 50,
	},
};
