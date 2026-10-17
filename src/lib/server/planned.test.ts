import { describe, expect, it } from 'vitest';
import { plannedForPeriod } from './planned';
import { budgetStatuses } from './alerts';
import { listBudgets, setLimit } from './budgets';
import { saveExpense } from './expenses';
import { saveIncome } from './incomes';
import { createRule, materializeDue, type RuleInput } from './recurring';
import { makeUser, testDb } from './test/db';

const TODAY = '2026-10-17';
const oct = { start: '2026-10-01', end: '2026-10-31' };

async function seed() {
	const db = testDb();
	const u = await makeUser(db);
	const budgets = listBudgets(db, u.id, '2026-10-01');
	const bud = (n: string) => budgets.find((b) => b.name === n)!;
	const cat = (n: string) => budgets.flatMap((b) => b.categories).find((c) => c.name === n)!;
	const expense = (date: string, cents: number, name = 'Courses', description = '') =>
		saveExpense(db, u.id, {
			date,
			totalCents: cents,
			placeId: null,
			description,
			splits: [{ categoryId: cat(name).id, amountCents: cents }],
			tags: []
		});
	const rule = (over: Partial<RuleInput>) =>
		createRule(db, u.id, {
			kind: 'expense',
			amountCents: 1299,
			categoryId: cat('Abonnements').id,
			placeId: null,
			source: '',
			description: 'Netflix',
			frequency: 'monthly',
			dayOfMonth: 25,
			startDate: '2026-01-25',
			endDate: null,
			active: true,
			...over
		});
	return { db, u, bud, cat, expense, rule };
}

describe('planned expenses', () => {
	it('future-dated entries of the period are planned, not spent', async () => {
		const { db, u, bud, expense } = await seed();
		expense('2026-10-10', 3000); // real
		expense(TODAY, 500); // today counts as real
		expense('2026-10-20', 4000, 'Courses', 'Gros plein'); // planned
		expense('2026-11-02', 9999); // next period
		const p = plannedForPeriod(db, u.id, oct, TODAY);
		expect(p.expense).toBe(4000);
		expect(p.items).toEqual([
			expect.objectContaining({
				date: '2026-10-20',
				kind: 'expense',
				amountCents: 4000,
				label: 'Gros plein',
				budgetId: bud('Alimentation').id,
				origin: 'entry'
			})
		]);
		expect(p.byBudget.get(bud('Alimentation').id)).toBe(4000);
	});

	it('upcoming recurring occurrences are planned until the period ends', async () => {
		const { db, u, bud, rule } = await seed();
		rule({}); // monthly on the 25th: 25 Oct is still to come
		rule({
			frequency: 'weekly',
			startDate: '2026-10-05',
			amountCents: 1000,
			description: 'Panier'
		});
		rule({ description: 'Fini', endDate: '2026-09-30' });
		rule({ description: 'En pause', active: false });
		materializeDue(db, { userId: u.id, today: TODAY });

		const p = plannedForPeriod(db, u.id, oct, TODAY);
		// Weekly from 5 Oct: 5, 12 already created; 19 and 26 to come
		expect(p.items.map((i) => [i.date, i.label, i.origin])).toEqual([
			['2026-10-19', 'Panier', 'rule'],
			['2026-10-25', 'Netflix', 'rule'],
			['2026-10-26', 'Panier', 'rule']
		]);
		expect(p.expense).toBe(1299 + 2000);
		expect(p.byBudget.get(bud('Loisirs').id)).toBe(1299 + 2000);
	});

	it('recurring income is planned income', async () => {
		const { db, u, rule } = await seed();
		rule({
			kind: 'income',
			categoryId: null,
			source: 'Salaire',
			amountCents: 200000,
			dayOfMonth: 28
		});
		const p = plannedForPeriod(db, u.id, oct, TODAY);
		expect(p.income).toBe(200000);
		expect(p.expense).toBe(0);
		expect(p.items[0]).toEqual(
			expect.objectContaining({ kind: 'income', label: 'Salaire', date: '2026-10-28' })
		);
	});

	it('a past period has nothing planned; a future one plans every occurrence', async () => {
		const { db, u, rule, expense } = await seed();
		rule({});
		expense('2026-11-01', 700); // first day of the next period
		materializeDue(db, { userId: u.id, today: TODAY });
		expect(
			plannedForPeriod(db, u.id, { start: '2026-09-01', end: '2026-09-30' }, TODAY).items
		).toEqual([]);
		const nov = plannedForPeriod(db, u.id, { start: '2026-11-01', end: '2026-11-30' }, TODAY);
		expect(nov.items.map((i) => i.date)).toEqual(['2026-11-01', '2026-11-25']);
	});

	it('budget statuses split real spending from planned, alerts follow the real part', async () => {
		const { db, u, bud, expense, rule } = await seed();
		const loisirs = bud('Loisirs');
		setLimit(db, u.id, loisirs.id, '2026-10-01', 5000);
		expense('2026-10-03', 1000, 'Sorties');
		expense('2026-10-30', 3000, 'Sorties');
		rule({ amountCents: 2000 });
		materializeDue(db, { userId: u.id, today: TODAY });
		const s = budgetStatuses(db, u.id, oct, TODAY).find((b) => b.id === loisirs.id)!;
		expect(s.spentCents).toBe(1000);
		expect(s.plannedCents).toBe(5000);
		expect(s.pct).toBe(20);
		expect(s.projectedPct).toBe(120);
		expect(s.status).toBe('ok');
	});

	it('only sees the user’s own data', async () => {
		const { db, rule } = await seed();
		rule({});
		const other = await makeUser(db);
		saveIncome(db, other.id, { date: '2026-10-30', amountCents: 1, source: 'x', description: '' });
		expect(plannedForPeriod(db, other.id, oct, TODAY).items).toHaveLength(1);
		expect(plannedForPeriod(db, other.id, oct, TODAY).items[0].kind).toBe('income');
	});
});
