import type { DB } from './db';
import { periodTotals } from './stats';
import { savingsNet } from './savings';
import { plannedForPeriod } from './planned';
import { addDays, todayISO } from '../periods';

/** Earlier than any real date, so a range starting here covers all history. */
const BEGINNING = '0000-01-01';

/** Income minus expenses minus money moved to savings, over a date range. */
export function netFlow(db: DB, userId: number, r: { from: string; to: string }): number {
	const { income, expense } = periodTotals(db, userId, r);
	return income - expense - savingsNet(db, userId, r);
}

/**
 * The balance carried into a period from everything before it, so what is left at the
 * end of one month starts the next. `real` counts entries dated up to today; for a period
 * that starts later than tomorrow, `planned` adds what is still to come before it
 * (entries dated in the future and recurring occurrences not created yet).
 */
export function carryOver(
	db: DB,
	userId: number,
	periodStart: string,
	today = todayISO()
): { real: number; planned: number } {
	const dayBefore = addDays(periodStart, -1);
	const real = netFlow(db, userId, {
		from: BEGINNING,
		to: dayBefore < today ? dayBefore : today
	});
	if (dayBefore <= today) return { real, planned: 0 };
	const p = plannedForPeriod(db, userId, { start: addDays(today, 1), end: dayBefore }, today);
	return { real, planned: p.income - p.expense };
}
