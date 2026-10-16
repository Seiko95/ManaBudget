import { describe, expect, it } from 'vitest';
import { distanceMetres, sortByDistance } from './geo';

describe('distanceMetres', () => {
	it('computes great-circle distance', () => {
		// Paris Notre-Dame → Tour Eiffel ≈ 4.1 km
		const d = distanceMetres({ lat: 48.853, lng: 2.3499 }, { lat: 48.8584, lng: 2.2945 });
		expect(d).toBeGreaterThan(4000);
		expect(d).toBeLessThan(4300);
		expect(distanceMetres({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
	});
});

describe('sortByDistance', () => {
	it('puts the nearest first and places without GPS last', () => {
		const here = { lat: 48.853, lng: 2.3499 };
		const places = [
			{ id: 1, lat: 48.8584, lng: 2.2945 },
			{ id: 2, lat: null, lng: null },
			{ id: 3, lat: 48.8535, lng: 2.35 }
		];
		const sorted = sortByDistance(places, here);
		expect(sorted.map((p) => p.id)).toEqual([3, 1, 2]);
		expect(sorted[0].distance).toBeLessThan(100);
		expect(sorted[2].distance).toBeNull();
	});
});
