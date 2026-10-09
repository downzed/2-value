import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../shared/Button';

interface NewFolderFormProps {
	/**
	 * Creates the folder and resolves on success. Must reject on failure so the
	 * error can be shown inline — the form owns the error state.
	 */
	onCreate: (name: string) => Promise<void>;
	onCancel: () => void;
	/**
	 * Stop Escape from bubbling, so cancelling the field does not also close the
	 * surrounding dialog.
	 */
	stopEscapePropagation?: boolean;
}

/**
 * Inline "create a folder" form, shared by the gallery's folder grid and the
 * folder picker.
 *
 * Owns the name, error and in-flight state so the callers do not each keep their
 * own copy of the same reset sequence.
 */
export const NewFolderForm: React.FC<NewFolderFormProps> = ({ onCreate, onCancel, stopEscapePropagation = false }) => {
	const [name, setName] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const reset = () => {
		setName('');
		setError(null);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		try {
			setCreating(true);
			setError(null);
			await onCreate(trimmed);
			reset();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to create folder.');
		} finally {
			setCreating(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className='rounded-lg border border-slate-300 bg-slate-50 p-2 flex flex-col gap-1'>
			<input
				ref={inputRef}
				type='text'
				value={name}
				onChange={(e) => {
					setName(e.target.value);
					setError(null);
				}}
				placeholder='Folder name'
				maxLength={100}
				disabled={creating}
				className='text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-slate-500 w-full'
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						if (stopEscapePropagation) e.stopPropagation();
						onCancel();
						reset();
					}
				}}
			/>
			{error && <p className='text-[10px] text-red-500'>{error}</p>}
			<div className='flex gap-1'>
				<Button
					type='submit'
					disabled={creating}
					disabledTone='faint'
					className='flex-1 text-[10px] bg-slate-800 text-white rounded py-1 hover:bg-slate-700'
				>
					Create
				</Button>
				<Button
					onClick={() => {
						onCancel();
						reset();
					}}
					className='flex-1 text-[10px] text-slate-500 hover:text-slate-700'
				>
					Cancel
				</Button>
			</div>
		</form>
	);
};
