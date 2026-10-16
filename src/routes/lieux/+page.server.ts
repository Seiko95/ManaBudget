import { getDb } from '$lib/server/db';
import { budgetOptions, listBudgets } from '$lib/server/budgets';
import { listPlaces, setPlaceArchived } from '$lib/server/places';
import { parseId, requireUser } from '$lib/server/scope';
import { bool, str } from '$lib/server/forms';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const db = getDb();
	const showArchived = url.searchParams.get('archives') === '1';
	// Category names for display, archived ones included
	const categoryNames = Object.fromEntries(
		listBudgets(db, user.id, '9999-12-31', { includeArchived: true }).flatMap((b) =>
			b.categories.map((c) => [c.id, `${b.icon} ${c.name}`])
		)
	);
	return {
		showArchived,
		places: listPlaces(db, user.id, { includeArchived: showArchived }),
		budgets: budgetOptions(db, user.id),
		categoryNames
	};
};

export const actions: Actions = {
	archive: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const archived = bool(form, 'archived');
		setPlaceArchived(getDb(), user.id, parseId(str(form, 'id')), archived);
		return { success: archived ? t.budgets.archivedDone : t.budgets.unarchivedDone };
	}
};
