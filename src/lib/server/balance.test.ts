import { describe, expect, it } from 'vitest';
import { carryOver, netFlow } from './balance';
import { listBudgets } from './budgets';
import { saveExpense } from './expenses';
import { saveIncome } from './incomes';
import { createRule, materializeDue } from './recurring';
import { saveTransfer } from './savings';
import { makeUser, testDb } from './test/db';

const TODAY = '2026-10-17';

async function seed(monthStartDay?: number) {
	const db = testDb();
	const u = await makeUser(db, { monthStartDay });
	const category = listBudgets(db, u.id, '2026-10-01')[0].categories[0];
	const expense = (date: string, cents: number) =>
		saveExpense(db, u.id, {
			date,
			totalCents: cents,
			placeId: null,
			description: '',
			splits: [{ categoryId: category.id, amountCents: cents }],
			tags: []
		});
	const income = (date: string, cents: number) =>
		saveIncome(db, u.id, { date, amountCents: cents, source: 'Salaire', description: '' });
	const save = (date: string, cents: number, direction: 'deposit' | 'withdrawal' = 'deposit') =>
		saveTransfer(
			db,
			u.id,
			{ date, direction, amountCents: cents, description: '' },
			undefined,
			TODAY
		);
	return { db, u, category, expense, income, save };
}

describe('balance carried over between periods', () => {
	it('starts a period with what was left at the end of the previous ones', async () => {
		const { db, u, expense, income, save } = await seed();
		income('2026-08-01', 200000);
		expense('2026-08-12', 150000);
		income('2026-09-01', 200000);
		expense('2026-09-10', 120000);
		save('2026-09-30', 30000); // moved to savings: leaves the balance, not spent
		income('2026-10-01', 999); // inside October: not part of what is carried into it

		expect(carryOver(db, u.id, '2026-08-01', TODAY)).toEqual({ real: 0, planned: 0 });
		expect(carryOver(db, u.id, '2026-09-01', TODAY)).toEqual({ real: 50000, planned: 0 });
		// 500 € left from August + 2000 − 1200 − 300 in September
		expect(carryOver(db, u.id, '2026-10-01', TODAY)).toEqual({ real: 100000, planned: 0 });
	});

	it('chains: each closing balance is the next opening balance', async () => {
		const { db, u, expense, income, save } = await seed(25);
		income('2026-07-25', 180000);
		expense('2026-08-03', 40000);
		income('2026-08-25', 180000);
		expense('2026-09-01', 210000); // a month that spends more than it earns
		save('2026-09-20', 5000);
		save('2026-09-24', 2000, 'withdrawal');
		income('2026-09-25', 180000);

		// Start day 25: "2026-09" runs 25 Aug – 24 Sep, "2026-10" runs 25 Sep – 24 Oct
		const sept = { from: '2026-08-25', to: '2026-09-24' };
		const opening = carryOver(db, u.id, '2026-08-25', TODAY).real;
		const closing = opening + netFlow(db, u.id, sept);
		expect(opening).toBe(140000);
		expect(closing).toBe(140000 + 180000 - 210000 - 5000 + 2000);
		expect(carryOver(db, u.id, '2026-09-25', TODAY).real).toBe(closing);
	});

	it('a negative balance carries over too', async () => {
		const { db, u, expense, income } = await seed();
		income('2026-09-01', 10000);
		expense('2026-09-05', 25000);
		expect(carryOver(db, u.id, '2026-10-01', TODAY).real).toBe(-15000);
	});

	it('for a later period, adds what is still planned before it starts', async () => {
		const { db, u, category, expense, income } = await seed();
		income('2026-10-01', 200000);
		expense('2026-10-05', 50000);
		expense('2026-10-20', 7000); // dated ahead in the current period
		income('2026-11-03', 999); // inside November itself
		createRule(db, u.id, {
			kind: 'expense',
			amountCents: 1000,
			categoryId: category.id,
			placeId: null,
			source: '',
			description: 'Abonnement',
			frequency: 'monthly',
			dayOfMonth: 25,
			startDate: '2026-01-25',
			endDate: null,
			active: true
		});
		materializeDue(db, { userId: u.id, today: TODAY }); // Jan–Sep occurrences are real

		const real = 200000 - 50000 - 9 * 1000;
		// Into November: the 20 Oct expense and the 25 Oct occurrence are still to come
		expect(carryOver(db, u.id, '2026-11-01', TODAY)).toEqual({ real, planned: -7000 - 1000 });
		// Into December: November's own entries are planned before it as well
		expect(carryOver(db, u.id, '2026-12-01', TODAY)).toEqual({
			real,
			planned: -7000 - 1000 + 999 - 1000
		});
	});
});
