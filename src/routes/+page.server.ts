import { getDb } from '$lib/server/db';
import { materializeDue } from '$lib/server/recurring';
import { selectedPeriod } from '$lib/server/period';
import { periodTotals } from '$lib/server/stats';
import { plannedForPeriod } from '$lib/server/planned';
import { carryOver } from '$lib/server/balance';
import { savingsNet, savingsTotal } from '$lib/server/savings';
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
	const totals = periodTotals(db, user.id, real);
	const saved = savingsNet(db, user.id, real);
	// What is left from earlier periods carries over, so the balance runs from month to month
	const carried = carryOver(db, user.id, period.start, today);
	const current = carried.real + totals.income - totals.expense - saved;
	return {
		period,
		forecast: period.end > today,
		totals,
		balance: {
			carried: carried.real + carried.planned,
			current,
			forecast: current + carried.planned + planned.income - planned.expense
		},
		savings: { total: savingsTotal(db, user.id, real.to), period: saved },
		planned: { items: planned.items, expense: planned.expense, income: planned.income },
		budgets: budgetStatuses(db, user.id, period, today),
		latest: listExpenses(db, user.id, { ...real, limit: 8 })
	};
};
