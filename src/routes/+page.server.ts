import { getDb } from '$lib/server/db';
import { materializeDue } from '$lib/server/recurring';
import { selectedPeriod } from '$lib/server/period';
import { periodTotals } from '$lib/server/stats';
import { plannedForPeriod } from '$lib/server/planned';
import { budgetStatuses } from '$lib/server/alerts';
import { listExpenses } from '$lib/server/expenses';
import { requireUser } from '$lib/server/scope';
import { todayISO } from '$lib/periods';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const db = getDb();
	materializeDue(db, { userId: user.id });
	const period = selectedPeriod(url, user);
	const today = todayISO();
	// Real figures stop at today; what comes after is "planned"
	const real = { from: period.start, to: period.end < today ? period.end : today };
	const planned = plannedForPeriod(db, user.id, period, today);
	return {
		period,
		forecast: period.end > today,
		totals: periodTotals(db, user.id, real),
		planned: { items: planned.items, expense: planned.expense, income: planned.income },
		budgets: budgetStatuses(db, user.id, period, today),
		latest: listExpenses(db, user.id, { ...real, limit: 8 })
	};
};
