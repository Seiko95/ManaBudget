import { getDb } from '$lib/server/db';
import { listBudgets } from '$lib/server/budgets';
import {
	incomeVsExpense,
	periodTotals,
	spentByBudget,
	spentByCategory,
	totalsByPlace
} from '$lib/server/stats';
import { currentPeriod } from '$lib/server/period';
import { requireUser } from '$lib/server/scope';
import { isPeriodLabel, periodRange, periodsEndingAt } from '$lib/periods';
import type { PageServerLoad } from './$types';

const RANGES = [1, 3, 6, 12] as const;

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const db = getDb();
	const current = currentPeriod(user).label;
	const finParam = url.searchParams.get('fin');
	const end = isPeriodLabel(finParam) ? finParam : current;
	const nParam = Number(url.searchParams.get('n'));
	const n = (RANGES as readonly number[]).includes(nParam) ? nParam : 1;
	const labels = periodsEndingAt(end, n);
	const from = periodRange(labels[0], user.monthStartDay).start;
	const to = periodRange(end, user.monthStartDay).end;
	const range = { from, to };

	const byBudget = spentByBudget(db, user.id, range);
	const byCategory = spentByCategory(db, user.id, range);
	// Archived budgets still count for past spending
	const budgets = listBudgets(db, user.id, '9999-12-31', { includeArchived: true })
		.map((b) => ({
			id: b.id,
			name: b.name,
			icon: b.icon,
			color: b.color,
			total: byBudget.get(b.id) ?? 0,
			categories: b.categories
				.map((c) => ({ id: c.id, name: c.name, total: byCategory.get(c.id) ?? 0 }))
				.filter((c) => c.total > 0)
				.sort((a, b) => b.total - a.total)
		}))
		.filter((b) => b.total > 0)
		.sort((a, b) => b.total - a.total);

	return {
		end,
		n,
		isCurrent: end === current,
		range,
		totals: periodTotals(db, user.id, range),
		budgets,
		trend: incomeVsExpense(db, user.id, periodsEndingAt(end, 12), user.monthStartDay),
		places: totalsByPlace(db, user.id, range, 20)
	};
};
