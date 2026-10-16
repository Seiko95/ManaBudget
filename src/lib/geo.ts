export type LatLng = { lat: number; lng: number };

const R = 6371008.8; // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180;

/** Haversine distance in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Adds `distance` (metres, or null without GPS) and sorts nearest first; GPS-less places keep their order at the end. */
export function sortByDistance<T extends { lat: number | null; lng: number | null }>(
	places: T[],
	here: LatLng
): (T & { distance: number | null })[] {
	return places
		.map((p) => ({
			...p,
			distance:
				p.lat != null && p.lng != null ? distanceMetres(here, { lat: p.lat, lng: p.lng }) : null
		}))
		.sort((a, b) => {
			if (a.distance == null) return b.distance == null ? 0 : 1;
			if (b.distance == null) return -1;
			return a.distance - b.distance;
		});
}
