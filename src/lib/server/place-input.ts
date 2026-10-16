import type { PlaceInput } from './places';

function num(v: unknown): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

/** Reads a place from a JSON body. */
export function placeInputFromJson(body: Record<string, unknown>): PlaceInput {
	const cat = num(body.defaultCategoryId);
	return {
		name: String(body.name ?? '').slice(0, 100),
		address: String(body.address ?? '').slice(0, 300),
		lat: num(body.lat),
		lng: num(body.lng),
		defaultCategoryId: cat && Number.isInteger(cat) ? cat : null
	};
}
