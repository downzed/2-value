export function openImageFile(): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = () => {
			const file = input.files?.[0] ?? null;
			input.remove();
			resolve(file);
		};
		input.addEventListener('cancel', () => {
			input.remove();
			resolve(null);
		});
		input.click();
	});
}

export async function saveImageFile(blob: Blob, suggestedName: string): Promise<void> {
	if ('showSaveFilePicker' in window) {
		try {
			const handle = await window.showSaveFilePicker({
				suggestedName,
				types: [
					{ description: 'PNG', accept: { 'image/png': ['.png'] } },
					{ description: 'JPEG', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
				],
			});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
			return;
		} catch {
			// Fall through to fallback
		}
	}

	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = suggestedName;
	a.click();
	URL.revokeObjectURL(url);
}
