import type { DB } from './db';
import type { SessionUser } from './auth';
import type { ExpenseInput } from './expenses';
import { listBudgets } from './budgets';
import { spentByBudget } from './stats';
import { periodFor } from '../periods';
import { alertMessageClient } from '../alert-text';

export type AlertStatus = 'none' | 'ok' | 'warning' | 'over';

export function statusFor(spentCents: number, limitCents: number, threshold: number): AlertStatus {
	if (limitCents <= 0) return 'none';
	const pct = (spentCents / limitCents) * 100;
	if (pct >= 100) return 'over';
	if (pct >= threshold) return 'warning';
	return 'ok';
}

export type BudgetStatus = {
	id: number;
	name: string;
	icon: string;
	color: string;
	alertThreshold: number;
	spentCents: number;
	limitCents: number;
	pct: number;
	status: AlertStatus;
};

/** Spending vs limit for every active budget in a period. */
export function budgetStatuses(
	db: DB,
	userId: number,
	period: { start: string; end: string }
): BudgetStatus[] {
	const spent = spentByBudget(db, userId, { from: period.start, to: period.end });
	return listBudgets(db, userId, period.start).map((b) => {
		const spentCents = spent.get(b.id) ?? 0;
		return {
			id: b.id,
			name: b.name,
			icon: b.icon,
			color: b.color,
			alertThreshold: b.alertThreshold,
			spentCents,
			limitCents: b.limitCents,
			pct: b.limitCents > 0 ? (spentCents / b.limitCents) * 100 : 0,
			status: statusFor(spentCents, b.limitCents, b.alertThreshold)
		};
	});
}

export function alertCount(db: DB, userId: number, period: { start: string; end: string }): number {
	return budgetStatuses(db, userId, period).filter(
		(s) => s.status === 'warning' || s.status === 'over'
	).length;
}

export const alertMessage = (s: Pick<BudgetStatus, 'name' | 'pct' | 'status'>) =>
	alertMessageClient(s);

const rank: Record<AlertStatus, number> = { none: 0, ok: 0, warning: 1, over: 2 };

/**
 * Snapshot budget usage (for the period of the expense's date) before a save;
 * the returned function lists the budgets whose status got worse because of it.
 */
export function alertsAfterSave(
	db: DB,
	user: Pick<SessionUser, 'id' | 'monthStartDay'>,
	input: ExpenseInput,
	_expenseId?: number
): () => string[] {
	const period = periodFor(input.date, user.monthStartDay);
	const before = new Map(budgetStatuses(db, user.id, period).map((s) => [s.id, s.status]));
	return () =>
		budgetStatuses(db, user.id, period)
			.filter((s) => rank[s.status] > rank[before.get(s.id) ?? 'none'])
			.map(alertMessage);
}
