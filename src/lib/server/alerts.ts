import type { DB } from './db';
import type { SessionUser } from './auth';
import type { ExpenseInput } from './expenses';
import { listBudgets } from './budgets';
import { spentByBudget } from './stats';
import { plannedForPeriod } from './planned';
import { periodFor, todayISO } from '../periods';
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
	/** Real spending: entries dated up to today. */
	spentCents: number;
	/** Still to come this period: future-dated entries and upcoming recurring occurrences. */
	plannedCents: number;
	limitCents: number;
	pct: number;
	/** (spent + planned) / limit. */
	projectedPct: number;
	/** Follows the real spending only, so "85 % utilisé" stays true. */
	status: AlertStatus;
	projectedStatus: AlertStatus;
};

/** Spending vs limit for every active budget in a period, real and planned. */
export function budgetStatuses(
	db: DB,
	userId: number,
	period: { start: string; end: string },
	today = todayISO()
): BudgetStatus[] {
	const spent = spentByBudget(db, userId, {
		from: period.start,
		to: period.end < today ? period.end : today
	});
	const planned = plannedForPeriod(db, userId, period, today).byBudget;
	return listBudgets(db, userId, period.start).map((b) => {
		const spentCents = spent.get(b.id) ?? 0;
		const plannedCents = planned.get(b.id) ?? 0;
		const pct = (cents: number) => (b.limitCents > 0 ? (cents / b.limitCents) * 100 : 0);
		return {
			id: b.id,
			name: b.name,
			icon: b.icon,
			color: b.color,
			alertThreshold: b.alertThreshold,
			spentCents,
			plannedCents,
			limitCents: b.limitCents,
			pct: pct(spentCents),
			projectedPct: pct(spentCents + plannedCents),
			status: statusFor(spentCents, b.limitCents, b.alertThreshold),
			projectedStatus: statusFor(spentCents + plannedCents, b.limitCents, b.alertThreshold)
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
