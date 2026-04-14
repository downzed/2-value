import type { ExternalImage, ExternalSearchResult } from '../../shared/types';
import { apiFetch, getRateLimiter } from '../image-provider';

interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	photographer: string;
	photographer_url: string;
	alt: string;
	src: {
		original: string;
		large2x: string;
		large: string;
		medium: string;
		small: string;
		tiny: string;
	};
}

interface PexelsSearchResponse {
	photos: PexelsPhoto[];
	page: number;
	per_page: number;
	total_results: number;
	next_page?: string;
}

interface PexelsCuratedResponse {
	photos: PexelsPhoto[];
	page: number;
	per_page: number;
	next_page?: string;
}

function normalizePhoto(photo: PexelsPhoto): ExternalImage {
	return {
		id: photo.id.toString(),
		url: photo.src.large || photo.src.original,
		thumbnail: photo.src.small || photo.src.tiny,
		width: photo.width,
		height: photo.height,
		author: photo.photographer,
		authorUrl: photo.photographer_url,
		source: 'pexels',
		sourceProvider: 'pexels',
		description: photo.alt ?? '',
	};
}

export class PexelsProvider {
	public apiKey: string;
	private rateLimiter: ReturnType<typeof getRateLimiter>;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
		this.rateLimiter = getRateLimiter('pexels');
	}

	async search(query: string, page = 1): Promise<ExternalSearchResult> {
		this.rateLimiter.check();

		const response = await apiFetch(this.apiKey, '/v1/search', {
			query,
			page,
			per_page: 15,
		});

		const data = (await response.json()) as PexelsSearchResponse;
		return {
			images: data.photos.map(normalizePhoto),
			page: data.page,
			hasMore: !!data.next_page,
		};
	}

	async getRandom(query?: string, count = 6): Promise<ExternalImage[]> {
		this.rateLimiter.check();

		if (query) {
			return this.search(query, 1).then((r) => r.images.slice(0, count));
		}

		this.rateLimiter.check();
		const response = await apiFetch(this.apiKey, '/v1/curated', {
			per_page: count,
		});
		console.log('here:', { response });

		const data = (await response.json()) as PexelsCuratedResponse;
		return data.photos.map(normalizePhoto);
	}
}
