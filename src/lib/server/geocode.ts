import { config } from './config';

export type GeocodeResult = { label: string; lat: number; lng: number };

type Options = {
	baseUrl: string;
	userAgent: string;
	fetchFn?: typeof fetch;
	minIntervalMs?: number;
	cacheSize?: number;
	cacheTtlMs?: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
};

/**
 * Server-side Nominatim proxy: requests are serialised at most one per second
 * (Nominatim usage policy), results are cached, and a User-Agent is always sent.
 */
export class Geocoder {
	private opts: Required<Options>;
	private cache = new Map<string, { at: number; value: unknown }>();
	private queue: Promise<unknown> = Promise.resolve();
	private lastRequest = -Infinity;

	constructor(opts: Options) {
		this.opts = {
			fetchFn: fetch,
			minIntervalMs: 1000,
			cacheSize: 500,
			cacheTtlMs: 7 * 24 * 3600 * 1000,
			now: Date.now,
			sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
			...opts
		};
	}

	private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
		const hit = this.cache.get(key);
		if (hit && this.opts.now() - hit.at < this.opts.cacheTtlMs) {
			// Refresh LRU position
			this.cache.delete(key);
			this.cache.set(key, hit);
			return hit.value as T;
		}
		const value = await load();
		this.cache.set(key, { at: this.opts.now(), value });
		if (this.cache.size > this.opts.cacheSize) this.cache.delete(this.cache.keys().next().value!);
		return value;
	}

	/** Runs `fn` after the previous request, at least minIntervalMs after it started. */
	private throttled<T>(fn: () => Promise<T>): Promise<T> {
		const run = async () => {
			const wait = this.lastRequest + this.opts.minIntervalMs - this.opts.now();
			if (wait > 0) await this.opts.sleep(wait);
			this.lastRequest = this.opts.now();
			return fn();
		};
		const p = this.queue.then(run, run);
		this.queue = p.catch(() => undefined);
		return p;
	}

	private async get(path: string, params: Record<string, string>): Promise<unknown> {
		const url = new URL(path, this.opts.baseUrl.replace(/\/?$/, '/'));
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		url.searchParams.set('format', 'jsonv2');
		url.searchParams.set('accept-language', 'fr');
		const res = await this.opts.fetchFn(url.toString(), {
			headers: { 'User-Agent': this.opts.userAgent, Accept: 'application/json' },
			signal: AbortSignal.timeout(10_000)
		});
		if (!res.ok) throw new Error(`Nominatim ${res.status}`);
		return res.json();
	}

	async search(query: string): Promise<GeocodeResult[]> {
		const q = query.trim().replace(/\s+/g, ' ');
		if (q.length < 3) return [];
		return this.cached(`s:${q.toLowerCase()}`, () =>
			this.throttled(async () => {
				const rows = (await this.get('search', { q, limit: '6', addressdetails: '0' })) as {
					display_name: string;
					lat: string;
					lon: string;
				}[];
				return rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
			})
		);
	}

	async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
		// ~10 m grid so nearby lookups share a cache entry
		const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
		return this.cached(key, () =>
			this.throttled(async () => {
				const r = (await this.get('reverse', {
					lat: String(lat),
					lon: String(lng),
					zoom: '18'
				})) as { display_name?: string; lat?: string; lon?: string };
				if (!r?.display_name) return null;
				return { label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) };
			})
		);
	}
}

let instance: Geocoder | undefined;

export function getGeocoder(): Geocoder | null {
	if (!config.geocodingEnabled) return null;
	instance ??= new Geocoder({ baseUrl: config.nominatimUrl, userAgent: config.geocoderUserAgent });
	return instance;
}
