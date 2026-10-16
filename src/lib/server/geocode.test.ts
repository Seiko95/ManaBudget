import { describe, expect, it, vi } from 'vitest';
import { Geocoder } from './geocode';

function fakeFetch() {
	return vi.fn(async (url: string | URL) => {
		const u = new URL(String(url));
		if (u.pathname.endsWith('/search'))
			return new Response(
				JSON.stringify([
					{ display_name: `Résultat ${u.searchParams.get('q')}`, lat: '48.85', lon: '2.35' }
				]),
				{ status: 200 }
			);
		return new Response(
			JSON.stringify({ display_name: '1 Rue de Rivoli, Paris', lat: '48.85', lon: '2.35' }),
			{ status: 200 }
		);
	});
}

describe('Geocoder', () => {
	it('sends a User-Agent, caches results and throttles to 1 req/s', async () => {
		const fetchFn = fakeFetch();
		let now = 0;
		const sleeps: number[] = [];
		const g = new Geocoder({
			baseUrl: 'https://nominatim.example',
			userAgent: 'ManaBudget-test',
			fetchFn: fetchFn as unknown as typeof fetch,
			now: () => now,
			sleep: async (ms) => {
				sleeps.push(ms);
				now += ms;
			}
		});
		const r1 = await g.search('carrefour');
		expect(r1).toEqual([{ label: 'Résultat carrefour', lat: 48.85, lng: 2.35 }]);
		const init = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect((init[1].headers as Record<string, string>)['User-Agent']).toBe('ManaBudget-test');

		// Same query (case/space-insensitive) is served from the cache
		await g.search('  Carrefour ');
		expect(fetchFn).toHaveBeenCalledTimes(1);

		// A different query right away waits until 1 s has passed
		now += 200;
		await g.search('lidl');
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(sleeps).toEqual([800]);

		const rev = await g.reverse(48.85, 2.35);
		expect(rev?.label).toBe('1 Rue de Rivoli, Paris');
	});

	it('ignores too-short queries', async () => {
		const fetchFn = fakeFetch();
		const g = new Geocoder({
			baseUrl: 'https://n.example',
			userAgent: 'x',
			fetchFn: fetchFn as unknown as typeof fetch
		});
		expect(await g.search('a')).toEqual([]);
		expect(fetchFn).not.toHaveBeenCalled();
	});
});
