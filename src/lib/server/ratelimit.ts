/** Fixed-window failure counter, in memory (one Node process, so this is enough). */
export class RateLimiter {
	private hits = new Map<string, { count: number; resetAt: number }>();
	private max: number;
	private windowMs: number;
	private now: () => number;

	constructor(opts: { max: number; windowMs: number; now?: () => number }) {
		this.max = opts.max;
		this.windowMs = opts.windowMs;
		this.now = opts.now ?? Date.now;
	}

	/** Milliseconds until the key may try again; 0 when allowed. */
	retryAfter(key: string): number {
		const entry = this.hits.get(key);
		if (!entry) return 0;
		const now = this.now();
		if (now >= entry.resetAt) {
			this.hits.delete(key);
			return 0;
		}
		return entry.count >= this.max ? entry.resetAt - now : 0;
	}

	fail(key: string) {
		const now = this.now();
		const entry = this.hits.get(key);
		if (!entry || now >= entry.resetAt)
			this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
		else entry.count++;
		if (this.hits.size > 10_000) this.prune();
	}

	reset(key: string) {
		this.hits.delete(key);
	}

	private prune() {
		const now = this.now();
		for (const [k, v] of this.hits) if (now >= v.resetAt) this.hits.delete(k);
	}
}

/** Login attempts: 10 failures per IP and 5 per username per 15 minutes. */
export const loginByIp = new RateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
export const loginByUser = new RateLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
