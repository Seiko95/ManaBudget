import { getDb } from '$lib/server/db';
import { materializeDue } from '$lib/server/recurring';
import { selectedPeriod } from '$lib/server/period';
import { periodTotals } from '$lib/server/stats';
import { budgetStatuses } from '$lib/server/alerts';
import { listExpenses } from '$lib/server/expenses';
import { requireUser } from '$lib/server/scope';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const db = getDb();
	materializeDue(db, { userId: user.id });
	const period = selectedPeriod(url, user);
	const range = { from: period.start, to: period.end };
	return {
		period,
		totals: periodTotals(db, user.id, range),
		budgets: budgetStatuses(db, user.id, period),
		latest: listExpenses(db, user.id, { ...range, limit: 8 })
	};
};
