import { describe, expect, it } from 'vitest';
import { alertsAfterSave, budgetStatuses, statusFor } from './alerts';
import { listBudgets, setLimit, updateBudget } from './budgets';
import { saveExpense, type ExpenseInput } from './expenses';
import { makeUser, testDb } from './test/db';

describe('statusFor', () => {
	it('ok below the threshold, warning from it, over from 100 %; none without a limit', () => {
		expect(statusFor(7900, 10000, 80)).toBe('ok');
		expect(statusFor(8000, 10000, 80)).toBe('warning');
		expect(statusFor(10000, 10000, 80)).toBe('over');
		expect(statusFor(5000, 0, 80)).toBe('none');
	});
});

const plain = (a: string[]) => a.map((s) => s.replace(/[\u00a0\u202f]/g, ' '));

describe('alerts', () => {
	it('lists budget statuses for a period and the toast after crossing a threshold', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const alim = listBudgets(db, user.id, '2026-10-01').find((b) => b.name === 'Alimentation')!;
		setLimit(db, user.id, alim.id, '2026-10-01', 10000);
		const input = (cents: number, date = '2026-10-10'): ExpenseInput => ({
			date,
			totalCents: cents,
			placeId: null,
			description: '',
			splits: [{ categoryId: alim.categories[0].id, amountCents: cents }],
			tags: []
		});
		const session = { ...user, monthStartDay: 1 };

		let watch = alertsAfterSave(db, session, input(5000));
		saveExpense(db, user.id, input(5000));
		expect(watch()).toEqual([]); // 50 %, nothing crossed

		watch = alertsAfterSave(db, session, input(3500));
		saveExpense(db, user.id, input(3500));
		expect(plain(watch())).toEqual(['Alimentation : 85 % du budget utilisé']);

		watch = alertsAfterSave(db, session, input(500));
		saveExpense(db, user.id, input(500));
		expect(watch()).toEqual([]); // still warning, not crossed again

		watch = alertsAfterSave(db, session, input(2000));
		saveExpense(db, user.id, input(2000));
		expect(plain(watch())).toEqual(['Alimentation : 110 % du budget utilisé (dépassé)']);

		const statuses = budgetStatuses(db, user.id, { start: '2026-10-01', end: '2026-10-31' });
		const s = statuses.find((x) => x.id === alim.id)!;
		expect(s).toMatchObject({ spentCents: 11000, limitCents: 10000, status: 'over' });
		expect(Math.round(s.pct)).toBe(110);
		// A custom threshold
		updateBudget(db, user.id, alim.id, { alertThreshold: 50 });
		expect(
			budgetStatuses(db, user.id, { start: '2026-09-01', end: '2026-09-30' }).find(
				(x) => x.id === alim.id
			)!.status
		).toBe('none'); // no limit before October
	});
});
