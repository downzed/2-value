import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextValue {
	showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

const getTypeStyles = (type: ToastType): string => {
	switch (type) {
		case 'error':
			return 'bg-red-500';
		case 'warning':
			return 'bg-yellow-500';
		default:
			return 'bg-blue-500';
	}
};

const getIcon = (type: ToastType) => {
	switch (type) {
		case 'success':
			return (
				<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>success</title>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
				</svg>
			);
		case 'error':
			return (
				<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>error</title>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
				</svg>
			);
		case 'warning':
			return (
				<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>warning</title>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
					/>
				</svg>
			);
		default:
			return (
				<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<title>default</title>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
					/>
				</svg>
			);
	}
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const showToast = useCallback((message: string, type: ToastType = 'info') => {
		const id = `toast-${++toastId}`;
		setToasts((prev) => [...prev, { id, message, type }]);
	}, []);

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<div className='fixed bottom-4 right-4 z-100 flex flex-col gap-2'>
				{toasts.map((toast) => (
					<div key={toast.id} className='flex items-center animate-slide-in'>
						<div
							className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white ${getTypeStyles(toast.type)}`}
						>
							{getIcon(toast.type)}
							<span className='text-sm font-medium'>{toast.message}</span>
							<button
								type='button'
								onClick={() => dismissToast(toast.id)}
								className='ml-2 opacity-70 hover:opacity-100 transition-opacity'
							>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<title>close</title>
									<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
};

export const useToast = (): ToastContextValue => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider');
	}
	return context;
};
