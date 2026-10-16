import { describe, expect, it } from 'vitest';
import {
	deleteExpense,
	getExpense,
	listExpenses,
	saveExpense,
	type ExpenseInput
} from './expenses';
import { listBudgets } from './budgets';
import { createPlace } from './places';
import { makeUser, testDb } from './test/db';
import type { DB } from './db';

function cats(db: DB, userId: number) {
	const b = listBudgets(db, userId, '2026-10-01');
	const byName = Object.fromEntries(b.flatMap((x) => x.categories.map((c) => [c.name, c])));
	return { budgets: b, byName };
}

function input(over: Partial<ExpenseInput>): ExpenseInput {
	return {
		date: '2026-10-10',
		totalCents: 1000,
		placeId: null,
		description: '',
		splits: [],
		tags: [],
		...over
	};
}

describe('saveExpense', () => {
	it('stores splits and tags, creating new tags by name (case-insensitive reuse)', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const { byName } = cats(db, u.id);
		const id = saveExpense(
			db,
			u.id,
			input({
				totalCents: 5000,
				splits: [
					{ categoryId: byName['Courses'].id, amountCents: 3000 },
					{ categoryId: byName['Sorties'].id, amountCents: 2000 }
				],
				tags: ['Vacances', 'apéro']
			})
		);
		const e = getExpense(db, u.id, id);
		expect(e.splits.map((s) => [s.categoryName, s.amountCents])).toEqual([
			['Courses', 3000],
			['Sorties', 2000]
		]);
		expect(e.tags.map((t) => t.name).sort()).toEqual(['Vacances', 'apéro']);
		const id2 = saveExpense(
			db,
			u.id,
			input({
				splits: [{ categoryId: byName['Courses'].id, amountCents: 1000 }],
				tags: ['vacances']
			})
		);
		expect(getExpense(db, u.id, id2).tags[0].id).toBe(
			e.tags.find((t) => t.name === 'Vacances')!.id
		);
	});

	it('rejects invalid splits', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const { byName } = cats(db, u.id);
		expect(() =>
			saveExpense(
				db,
				u.id,
				input({ splits: [{ categoryId: byName['Courses'].id, amountCents: 999 }] })
			)
		).toThrow();
	});

	it('updates in place, replacing splits and tags', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const { byName } = cats(db, u.id);
		const id = saveExpense(
			db,
			u.id,
			input({ splits: [{ categoryId: byName['Courses'].id, amountCents: 1000 }], tags: ['a'] })
		);
		saveExpense(
			db,
			u.id,
			input({
				totalCents: 2000,
				splits: [{ categoryId: byName['Restaurants'].id, amountCents: 2000 }],
				tags: []
			}),
			id
		);
		const e = getExpense(db, u.id, id);
		expect(e.totalCents).toBe(2000);
		expect(e.splits).toHaveLength(1);
		expect(e.splits[0].categoryName).toBe('Restaurants');
		expect(e.tags).toHaveLength(0);
	});
});

describe('listExpenses filters', () => {
	it('filters by date range, budget, category, place, tag, amount and text', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const { byName, budgets } = cats(db, u.id);
		const carrefour = createPlace(db, u.id, {
			name: 'Carrefour',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: null
		});
		saveExpense(
			db,
			u.id,
			input({
				date: '2026-10-01',
				totalCents: 4200,
				placeId: carrefour.id,
				description: 'Grosses courses',
				splits: [{ categoryId: byName['Courses'].id, amountCents: 4200 }],
				tags: ['semaine']
			})
		);
		saveExpense(
			db,
			u.id,
			input({
				date: '2026-10-05',
				totalCents: 1500,
				description: 'Cinéma',
				splits: [{ categoryId: byName['Sorties'].id, amountCents: 1500 }]
			})
		);
		saveExpense(
			db,
			u.id,
			input({
				date: '2026-09-20',
				totalCents: 800,
				description: 'Pain',
				splits: [{ categoryId: byName['Courses'].id, amountCents: 800 }]
			})
		);
		const all = listExpenses(db, u.id, {});
		expect(all.map((e) => e.description)).toEqual(['Cinéma', 'Grosses courses', 'Pain']);
		expect(listExpenses(db, u.id, { from: '2026-10-01', to: '2026-10-31' })).toHaveLength(2);
		const alimentation = budgets.find((b) => b.name === 'Alimentation')!;
		expect(listExpenses(db, u.id, { budgetId: alimentation.id }).map((e) => e.description)).toEqual(
			['Grosses courses', 'Pain']
		);
		expect(listExpenses(db, u.id, { categoryId: byName['Sorties'].id })).toHaveLength(1);
		expect(listExpenses(db, u.id, { placeId: carrefour.id })).toHaveLength(1);
		const tagId = getExpense(db, u.id, all[1].id).tags[0].id;
		expect(listExpenses(db, u.id, { tagId })).toHaveLength(1);
		expect(
			listExpenses(db, u.id, { minCents: 1000, maxCents: 2000 }).map((e) => e.description)
		).toEqual(['Cinéma']);
		expect(listExpenses(db, u.id, { q: 'carref' })).toHaveLength(1); // place name
		expect(listExpenses(db, u.id, { q: 'ciné' })).toHaveLength(1); // description
		expect(listExpenses(db, u.id, { q: 'semaine' })).toHaveLength(1); // tag
	});
});

describe('user isolation', () => {
	it("user B can't read, list, edit, delete, or file under A's categories/places", async () => {
		const db = testDb();
		const a = await makeUser(db);
		const b = await makeUser(db);
		const aCats = cats(db, a.id).byName;
		const bCats = cats(db, b.id).byName;
		const aPlace = createPlace(db, a.id, {
			name: 'A',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: null
		});
		const id = saveExpense(
			db,
			a.id,
			input({ splits: [{ categoryId: aCats['Courses'].id, amountCents: 1000 }] })
		);
		expect(listExpenses(db, b.id, {})).toHaveLength(0);
		expect(() => getExpense(db, b.id, id)).toThrow();
		expect(() =>
			saveExpense(
				db,
				b.id,
				input({ splits: [{ categoryId: bCats['Courses'].id, amountCents: 1000 }] }),
				id
			)
		).toThrow();
		expect(() => deleteExpense(db, b.id, id)).toThrow();
		expect(() =>
			saveExpense(
				db,
				b.id,
				input({ splits: [{ categoryId: aCats['Courses'].id, amountCents: 1000 }] })
			)
		).toThrow();
		expect(() =>
			saveExpense(
				db,
				b.id,
				input({
					placeId: aPlace.id,
					splits: [{ categoryId: bCats['Courses'].id, amountCents: 1000 }]
				})
			)
		).toThrow();
		expect(getExpense(db, a.id, id).totalCents).toBe(1000);
	});
});
