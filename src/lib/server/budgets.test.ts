import { describe, expect, it } from 'vitest';
import {
	createBudget,
	createCategory,
	getLimitCents,
	listBudgets,
	moveBudget,
	setBudgetArchived,
	setLimit,
	updateBudget,
	updateCategory
} from './budgets';
import { makeUser, testDb } from './test/db';

describe('budget limit history', () => {
	it('uses the latest limit effective on or before the period start', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const b = createBudget(db, u.id, {
			name: 'Vacances',
			color: '#2a78d6',
			icon: '',
			alertThreshold: 80,
			limitCents: 10000,
			periodStart: '2026-09-01'
		});
		expect(getLimitCents(db, b.id, '2026-09-01')).toBe(10000);
		expect(getLimitCents(db, b.id, '2026-08-01')).toBe(0); // before creation: no limit
		setLimit(db, u.id, b.id, '2026-11-01', 20000);
		expect(getLimitCents(db, b.id, '2026-10-01')).toBe(10000); // October untouched
		expect(getLimitCents(db, b.id, '2026-11-01')).toBe(20000);
		expect(getLimitCents(db, b.id, '2027-03-01')).toBe(20000);
		// Editing the same period again replaces that row
		setLimit(db, u.id, b.id, '2026-11-01', 25000);
		expect(getLimitCents(db, b.id, '2026-11-01')).toBe(25000);
		// Starter budgets have no limit
		const starter = listBudgets(db, u.id, '2026-10-01').find((x) => x.name === 'Alimentation')!;
		expect(starter.limitCents).toBe(0);
	});

	it('works with mid-month period starts (start day 25)', async () => {
		const db = testDb();
		const u = await makeUser(db, { monthStartDay: 25 });
		const b = createBudget(db, u.id, {
			name: 'X',
			color: '#2a78d6',
			icon: '',
			alertThreshold: 80,
			limitCents: 5000,
			periodStart: '2026-09-25'
		});
		setLimit(db, u.id, b.id, '2026-10-25', 7000);
		expect(getLimitCents(db, b.id, '2026-09-25')).toBe(5000);
		expect(getLimitCents(db, b.id, '2026-10-25')).toBe(7000);
	});
});

describe('budgets & categories', () => {
	it('lists budgets in order with their categories, hides archived unless asked', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const list = listBudgets(db, u.id, '2026-10-01');
		expect(list[0].name).toBe('Alimentation');
		expect(list[0].categories.map((c) => c.name)).toEqual([
			'Courses',
			'Restaurants',
			'Snacks & cafés'
		]);
		moveBudget(db, u.id, list[1].id, 'up');
		expect(listBudgets(db, u.id, '2026-10-01')[0].name).toBe('Logement');
		setBudgetArchived(db, u.id, list[0].id, true);
		expect(listBudgets(db, u.id, '2026-10-01').map((b) => b.name)).not.toContain('Alimentation');
		expect(
			listBudgets(db, u.id, '2026-10-01', { includeArchived: true }).map((b) => b.name)
		).toContain('Alimentation');
	});

	it("refuses to touch another user's budgets and categories", async () => {
		const db = testDb();
		const a = await makeUser(db);
		const b = await makeUser(db);
		const aBudget = listBudgets(db, a.id, '2026-10-01')[0];
		const bBudget = listBudgets(db, b.id, '2026-10-01')[0];
		expect(() => updateBudget(db, b.id, aBudget.id, { name: 'pwned' })).toThrow();
		expect(() => setLimit(db, b.id, aBudget.id, '2026-10-01', 1)).toThrow();
		expect(() => setBudgetArchived(db, b.id, aBudget.id, true)).toThrow();
		expect(() => createCategory(db, b.id, { budgetId: aBudget.id, name: 'x', icon: '' })).toThrow();
		expect(() => updateCategory(db, b.id, aBudget.categories[0].id, { name: 'x' })).toThrow();
		// Moving a category into someone else's budget is refused too
		expect(() =>
			updateCategory(db, b.id, bBudget.categories[0].id, { budgetId: aBudget.id })
		).toThrow();
		expect(listBudgets(db, a.id, '2026-10-01')[0].name).toBe('Alimentation');
	});
});
