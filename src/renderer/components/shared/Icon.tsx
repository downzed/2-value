const ICON_PATHS = {
	close: ['M6 18L18 6M6 6l12 12'],
	sliders: [
		'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
	],
	image: [
		'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
	],
	clock: ['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'],
	'eye-open': [
		'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
		'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
	],
	'eye-closed': [
		'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
	],
	undo: ['M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4'],
	redo: ['M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

const SIZE_CLASSES: Record<string, string> = {
	sm: 'w-3.5 h-3.5',
	md: 'w-4 h-4',
	lg: 'w-12 h-12',
};

interface IconProps {
	name: IconName;
	size?: 'sm' | 'md' | 'lg';
	className?: string;
	strokeWidth?: number;
}

export const Icon = ({ name, size = 'md', className, strokeWidth }: IconProps) => {
	const paths = ICON_PATHS[name];
	const sizeClass = SIZE_CLASSES[size];

	return (
		<svg className={`${sizeClass} ${className ?? ''}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<title>{name}</title>
			{paths.map((d) => (
				<path key={d} strokeLinecap='round' strokeLinejoin='round' strokeWidth={strokeWidth ?? 2} d={d} />
			))}
		</svg>
	);
};
