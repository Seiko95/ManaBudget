import { getDb } from '$lib/server/db';
import { countAndSum, listExpenses, listTags } from '$lib/server/expenses';
import { parseExpenseFilters } from '$lib/server/expense-filters';
import { budgetOptions, listBudgets } from '$lib/server/budgets';
import { listPlaces } from '$lib/server/places';
import { requireUser } from '$lib/server/scope';
import type { PageServerLoad } from './$types';

const PAGE = 200;

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const db = getDb();
	const filters = parseExpenseFilters(url, user);
	const limit = Math.min(10_000, Math.max(PAGE, Number(url.searchParams.get('limite')) || PAGE));
	const summary = countAndSum(db, user.id, filters);
	return {
		filters,
		limit,
		summary,
		expenses: listExpenses(db, user.id, { ...filters, limit }),
		options: {
			// Archived budgets/categories/places stay filterable
			budgets: listBudgets(db, user.id, '9999-12-31', { includeArchived: true }).map((b) => ({
				id: b.id,
				name: b.name,
				icon: b.icon,
				color: b.color,
				categories: b.categories.map((c) => ({
					id: c.id,
					name: c.name,
					icon: c.icon,
					budgetId: c.budgetId
				}))
			})),
			activeBudgets: budgetOptions(db, user.id),
			places: listPlaces(db, user.id, { includeArchived: true }).map((p) => ({
				id: p.id,
				name: p.name
			})),
			tags: listTags(db, user.id)
		}
	};
};
