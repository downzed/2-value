module.exports = {
	packagerConfig: {
		name: '2-value',
		executableName: '2-value',
		asar: true,
	},
	rebuildConfig: {},
	makers: [
		{
			name: '@electron-forge/maker-squirrel',
			config: { name: '2value' },
		},
		{
			name: '@electron-forge/maker-deb',
			config: {},
		},
		{
			name: '@electron-forge/maker-rpm',
			config: {},
		},
		{
			name: '@electron-forge/maker-flatpak',
			config: {
				options: {
					id: 'com.example.2value',
				},
			},
		},
	],
	plugins: [],
};
