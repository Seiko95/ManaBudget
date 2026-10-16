import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createPlace, validatePlaceInput } from '$lib/server/places';
import { placeInputFromJson } from '$lib/server/place-input';
import { requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const input = placeInputFromJson(await request.json().catch(() => ({})));
	const err = validatePlaceInput(input);
	if (err) error(400, err);
	return json({ place: createPlace(getDb(), user.id, input) }, { status: 201 });
};
