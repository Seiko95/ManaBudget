import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { budgetOptions } from '$lib/server/budgets';
import { listPlaces } from '$lib/server/places';
import { listTags } from '$lib/server/expenses';
import { requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

/** Everything the expense form needs to fill its pickers. */
export const GET: RequestHandler = ({ locals }) => {
	const user = requireUser(locals);
	const db = getDb();
	return json({
		budgets: budgetOptions(db, user.id),
		places: listPlaces(db, user.id).map((p) => ({
			id: p.id,
			name: p.name,
			address: p.address,
			lat: p.lat,
			lng: p.lng,
			defaultCategoryId: p.defaultCategoryId
		})),
		tags: listTags(db, user.id)
	});
};
