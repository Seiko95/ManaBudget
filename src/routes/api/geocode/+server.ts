import { error, json } from '@sveltejs/kit';
import { getGeocoder } from '$lib/server/geocode';
import { requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requireUser(locals);
	const geocoder = getGeocoder();
	if (!geocoder) error(503, 'Géocodage désactivé');
	const q = (url.searchParams.get('q') ?? '').slice(0, 200);
	try {
		return json({ results: await geocoder.search(q) });
	} catch {
		error(502, 'Géocodage indisponible');
	}
};
