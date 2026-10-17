import { describe, expect, it } from 'vitest';
import {
	incomeVsExpense,
	periodTotals,
	spentByBudget,
	spentByCategory,
	spentByPlace,
	totalsByPlace
} from './stats';
import { listBudgets } from './budgets';
import { saveExpense } from './expenses';
import { saveIncome } from './incomes';
import { createPlace } from './places';
import { makeUser, testDb } from './test/db';

async function seed() {
	const db = testDb();
	const u = await makeUser(db);
	const other = await makeUser(db);
	const budgets = listBudgets(db, u.id, '2026-10-01');
	const cat = Object.fromEntries(budgets.flatMap((b) => b.categories.map((c) => [c.name, c])));
	const bud = Object.fromEntries(budgets.map((b) => [b.name, b]));
	const shop = createPlace(db, u.id, {
		name: 'Carrefour',
		address: '',
		lat: 48.85,
		lng: 2.35,
		defaultCategoryId: null
	});
	const exp = (date: string, splits: [string, number][], placeId: number | null = null) =>
		saveExpense(db, u.id, {
			date,
			totalCents: splits.reduce((s, x) => s + x[1], 0),
			placeId,
			description: '',
			splits: splits.map(([n, a]) => ({ categoryId: cat[n].id, amountCents: a })),
			tags: []
		});
	exp(
		'2026-10-02',
		[
			['Courses', 3000],
			['Sorties', 1000]
		],
		shop.id
	);
	exp('2026-10-10', [['Restaurants', 2500]]);
	exp('2026-10-12', [['Courses', 500]], shop.id);
	exp('2026-09-28', [['Courses', 9999]]);
	saveIncome(db, u.id, {
		date: '2026-10-01',
		amountCents: 200000,
		source: 'Salaire',
		description: ''
	});
	saveIncome(db, u.id, {
		date: '2026-09-01',
		amountCents: 150000,
		source: 'Salaire',
		description: ''
	});
	// Noise from another user must never be counted
	const oCat = listBudgets(db, other.id, '2026-10-01')[0].categories[0];
	saveExpense(db, other.id, {
		date: '2026-10-05',
		totalCents: 77777,
		placeId: null,
		description: '',
		splits: [{ categoryId: oCat.id, amountCents: 77777 }],
		tags: []
	});
	saveIncome(db, other.id, {
		date: '2026-10-05',
		amountCents: 55555,
		source: 'x',
		description: ''
	});
	return { db, u, cat, bud, shop };
}

const oct = { from: '2026-10-01', to: '2026-10-31' };

describe('stats', () => {
	it('sums spending per budget and per category from splits', async () => {
		const { db, u, cat, bud } = await seed();
		const byBudget = spentByBudget(db, u.id, oct);
		expect(byBudget.get(bud['Alimentation'].id)).toBe(3000 + 2500 + 500);
		expect(byBudget.get(bud['Loisirs'].id)).toBe(1000);
		expect(byBudget.get(bud['Logement'].id)).toBeUndefined();
		const byCat = spentByCategory(db, u.id, oct);
		expect(byCat.get(cat['Courses'].id)).toBe(3500);
		expect(byCat.get(cat['Restaurants'].id)).toBe(2500);
	});

	it('totals income and expenses for a period', async () => {
		const { db, u } = await seed();
		expect(periodTotals(db, u.id, oct)).toEqual({ income: 200000, expense: 7000 });
	});

	it('income vs expense over several periods (start day 1)', async () => {
		const { db, u } = await seed();
		expect(incomeVsExpense(db, u.id, ['2026-08', '2026-09', '2026-10'], 1)).toEqual([
			{ label: '2026-08', income: 0, expense: 0 },
			{ label: '2026-09', income: 150000, expense: 9999 },
			{ label: '2026-10', income: 200000, expense: 7000 }
		]);
	});

	it('income vs expense honours a custom start day', async () => {
		const { db, u } = await seed();
		// Start day 25: "2026-10" = 25 Sept – 24 Oct, so the 28 Sept expense is in October
		const rows = incomeVsExpense(db, u.id, ['2026-10', '2026-11'], 25);
		expect(rows[0]).toEqual({ label: '2026-10', income: 200000, expense: 9999 + 7000 });
	});

	it('totals per place with GPS, biggest first', async () => {
		const { db, u, shop } = await seed();
		const rows = totalsByPlace(db, u.id, oct);
		expect(rows).toEqual([
			{ placeId: shop.id, name: 'Carrefour', lat: 48.85, lng: 2.35, total: 4500, count: 2 }
		]);
	});

	it('spent per place for a period, places without GPS included', async () => {
		const { db, u, shop } = await seed();
		const noGps = createPlace(db, u.id, {
			name: 'Marché',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: null
		});
		const courses = listBudgets(db, u.id, '2026-10-01')[0].categories[0];
		saveExpense(db, u.id, {
			date: '2026-10-20',
			totalCents: 800,
			placeId: noGps.id,
			description: '',
			splits: [{ categoryId: courses.id, amountCents: 800 }],
			tags: []
		});
		const byPlace = spentByPlace(db, u.id, oct);
		expect(byPlace.get(shop.id)).toBe(4500);
		expect(byPlace.get(noGps.id)).toBe(800);
		expect(byPlace.size).toBe(2);
		expect(spentByPlace(db, u.id, { from: '2026-11-01', to: '2026-11-30' }).size).toBe(0);
	});
});
