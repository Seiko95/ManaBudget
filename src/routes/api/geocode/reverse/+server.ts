import { error, json } from '@sveltejs/kit';
import { getGeocoder } from '$lib/server/geocode';
import { requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requireUser(locals);
	const geocoder = getGeocoder();
	if (!geocoder) error(503, 'Géocodage désactivé');
	const lat = Number(url.searchParams.get('lat'));
	const lng = Number(url.searchParams.get('lng'));
	if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
		error(400, 'Coordonnées invalides');
	try {
		return json({ result: await geocoder.reverse(lat, lng) });
	} catch {
		error(502, 'Géocodage indisponible');
	}
};
