import { describe, expect, it } from 'vitest';
import { categoryUsage, deleteBudget, deleteCategory, getLimitCents, listBudgets } from './budgets';
import { getExpense, saveExpense } from './expenses';
import { createPlace, getPlace } from './places';
import { createRule, getRule } from './recurring';
import { spentByCategory } from './stats';
import { makeUser, testDb } from './test/db';

async function seed() {
	const db = testDb();
	const u = await makeUser(db);
	const all = () => listBudgets(db, u.id, '2026-10-01', { includeArchived: true });
	const cat = (name: string) =>
		all()
			.flatMap((b) => b.categories)
			.find((c) => c.name === name)!;
	const bud = (name: string) => all().find((b) => b.name === name)!;
	const expense = (splits: [string, number][]) =>
		saveExpense(db, u.id, {
			date: '2026-10-05',
			totalCents: splits.reduce((s, x) => s + x[1], 0),
			placeId: null,
			description: '',
			splits: splits.map(([n, a]) => ({ categoryId: cat(n).id, amountCents: a })),
			tags: []
		});
	const rule = (name: string) =>
		createRule(db, u.id, {
			kind: 'expense',
			amountCents: 900,
			categoryId: cat(name).id,
			placeId: null,
			source: '',
			description: '',
			frequency: 'monthly',
			dayOfMonth: 1,
			startDate: '2099-01-01',
			endDate: null,
			active: true
		});
	return { db, u, all, cat, bud, expense, rule };
}

const oct = { from: '2026-10-01', to: '2026-10-31' };

describe('deleting categories', () => {
	it('deletes an unused category without asking for a replacement', async () => {
		const { db, u, cat, all } = await seed();
		const id = cat('Snacks & cafés').id;
		expect(categoryUsage(db, u.id).byCategory.get(id)).toBeUndefined();
		deleteCategory(db, u.id, id, null);
		expect(
			all()
				.flatMap((b) => b.categories)
				.some((c) => c.id === id)
		).toBe(false);
	});

	it('refuses to delete a used category without a replacement', async () => {
		const { db, u, cat, expense } = await seed();
		expense([['Restaurants', 1000]]);
		expect(categoryUsage(db, u.id).byCategory.get(cat('Restaurants').id)).toEqual({
			splits: 1,
			rules: 0
		});
		expect(() => deleteCategory(db, u.id, cat('Restaurants').id, null)).toThrow();
		expect(cat('Restaurants')).toBeDefined();
	});

	it('moves splits (merging into an existing one) and recurring rules, then deletes', async () => {
		const { db, u, cat, expense, rule } = await seed();
		const restaurants = cat('Restaurants').id;
		const courses = cat('Courses').id;
		const merged = expense([
			['Restaurants', 1000],
			['Courses', 500]
		]);
		const moved = expense([['Restaurants', 300]]);
		const r = rule('Restaurants');
		const place = createPlace(db, u.id, {
			name: 'Bistrot',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: restaurants
		});

		deleteCategory(db, u.id, restaurants, courses);

		const m = getExpense(db, u.id, merged);
		expect(m.totalCents).toBe(1500);
		expect(m.splits).toEqual([expect.objectContaining({ categoryId: courses, amountCents: 1500 })]);
		expect(getExpense(db, u.id, moved).splits).toEqual([
			expect.objectContaining({ categoryId: courses, amountCents: 300 })
		]);
		expect(getRule(db, u.id, r.id).categoryId).toBe(courses);
		expect(getPlace(db, u.id, place.id).defaultCategoryId).toBeNull();
		expect(spentByCategory(db, u.id, oct).get(courses)).toBe(1800);
		expect(spentByCategory(db, u.id, oct).has(restaurants)).toBe(false);
	});

	it('rejects the category itself or another user’s category as replacement', async () => {
		const { db, u, cat, expense } = await seed();
		const other = await makeUser(db);
		const otherCat = listBudgets(db, other.id, '2026-10-01')[0].categories[0].id;
		expense([['Restaurants', 1000]]);
		const id = cat('Restaurants').id;
		expect(() => deleteCategory(db, u.id, id, id)).toThrow();
		expect(() => deleteCategory(db, u.id, id, otherCat)).toThrow();
		expect(() => deleteCategory(db, other.id, id, otherCat)).toThrow();
		expect(cat('Restaurants')).toBeDefined();
	});
});

describe('deleting budgets', () => {
	it('moves every category’s splits and rules out of the budget, then deletes it with its limits', async () => {
		const { db, u, cat, bud, all, expense, rule } = await seed();
		const alimentation = bud('Alimentation');
		const divers = cat('Divers').id;
		const e = expense([
			['Courses', 1000],
			['Restaurants', 400],
			['Divers', 100]
		]);
		const r = rule('Snacks & cafés');
		expect(categoryUsage(db, u.id).byBudget.get(alimentation.id)).toEqual({ splits: 2, rules: 1 });

		expect(() => deleteBudget(db, u.id, alimentation.id, null)).toThrow();
		// A replacement inside the budget being deleted makes no sense
		expect(() => deleteBudget(db, u.id, alimentation.id, cat('Courses').id)).toThrow();

		deleteBudget(db, u.id, alimentation.id, divers);
		expect(all().some((b) => b.id === alimentation.id)).toBe(false);
		expect(getExpense(db, u.id, e).splits).toEqual([
			expect.objectContaining({ categoryId: divers, amountCents: 1500 })
		]);
		expect(getRule(db, u.id, r.id).categoryId).toBe(divers);
		expect(getLimitCents(db, alimentation.id, '2026-10-01')).toBe(0);
	});

	it('deletes an unused budget directly', async () => {
		const { db, u, bud, all } = await seed();
		deleteBudget(db, u.id, bud('Cadeaux').id, null);
		expect(all().some((b) => b.name === 'Cadeaux')).toBe(false);
	});
});
