import { describe, expect, it } from 'vitest';
import { RateLimiter } from './ratelimit';

describe('RateLimiter', () => {
	it('blocks after max failures within the window and recovers after it', () => {
		let now = 0;
		const rl = new RateLimiter({ max: 3, windowMs: 1000, now: () => now });
		expect(rl.retryAfter('k')).toBe(0);
		rl.fail('k');
		rl.fail('k');
		expect(rl.retryAfter('k')).toBe(0);
		rl.fail('k');
		expect(rl.retryAfter('k')).toBeGreaterThan(0);
		expect(rl.retryAfter('other')).toBe(0);
		now = 1001;
		expect(rl.retryAfter('k')).toBe(0);
	});
	it('reset clears a key', () => {
		const rl = new RateLimiter({ max: 1, windowMs: 1000 });
		rl.fail('k');
		expect(rl.retryAfter('k')).toBeGreaterThan(0);
		rl.reset('k');
		expect(rl.retryAfter('k')).toBe(0);
	});
});
