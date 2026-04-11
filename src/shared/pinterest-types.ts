/** Pinterest board object returned by the API */
export interface PinterestBoard {
	id: string;
	name: string;
	description: string;
	pin_count: number;
	privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
	created_at: string;
	owner: {
		username: string;
	};
	media?: {
		image_cover_url?: string;
	};
}

/** Pinterest pin object */
export interface PinterestPin {
	id: string;
	link?: string;
	title?: string;
	description?: string;
	board_id: string;
	created_at: string;
	media?: {
		images?: {
			'236x'?: { url: string; width: number; height: number };
			'736x'?: { url: string; width: number; height: number };
		};
	};
}

/** Paginated response wrapper from Pinterest v5 API */
export interface PinterestPaginatedResponse<T> {
	items: T[];
	bookmark?: string;
}

/** OAuth token data stored securely */
export interface PinterestTokenData {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	tokenType: string;
	scope: string;
}

/** Result of initiating the OAuth flow */
export interface PinterestAuthResult {
	ok: boolean;
	error?: string;
}

/** Arguments for saving a pin to a board */
export interface SavePinArgs {
	boardId: string;
	imageDataUrl: string;
	title?: string;
	description?: string;
	link?: string;
}

/** Result of a save-pin operation */
export interface SavePinResult {
	ok: boolean;
	pin?: PinterestPin;
	error?: string;
}
