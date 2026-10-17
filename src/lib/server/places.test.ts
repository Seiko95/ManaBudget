import { describe, expect, it } from 'vitest';
import {
	createPlace,
	listPlaces,
	setPlaceArchived,
	updatePlace,
	getPlace,
	validatePlaceInput,
	deletePlace
} from './places';
import { getExpense, saveExpense } from './expenses';
import { createRule, getRule } from './recurring';
import { listBudgets } from './budgets';
import { makeUser, testDb } from './test/db';

describe('places', () => {
	it('creates, updates, archives (archived hidden by default)', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const courses = listBudgets(db, u.id, '2026-10-01')[0].categories[0];
		const p = createPlace(db, u.id, {
			name: 'Carrefour',
			address: '1 rue X',
			lat: 48.85,
			lng: 2.35,
			defaultCategoryId: courses.id
		});
		expect(getPlace(db, u.id, p.id).defaultCategoryId).toBe(courses.id);
		updatePlace(db, u.id, p.id, {
			name: 'Carrefour Market',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: null
		});
		expect(getPlace(db, u.id, p.id).name).toBe('Carrefour Market');
		setPlaceArchived(db, u.id, p.id, true);
		expect(listPlaces(db, u.id)).toHaveLength(0);
		expect(listPlaces(db, u.id, { includeArchived: true })).toHaveLength(1);
	});

	it("isolates users: no reading, editing or using another user's category", async () => {
		const db = testDb();
		const a = await makeUser(db);
		const b = await makeUser(db);
		const aCat = listBudgets(db, a.id, '2026-10-01')[0].categories[0];
		const p = createPlace(db, a.id, {
			name: 'Chez A',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: null
		});
		expect(listPlaces(db, b.id)).toHaveLength(0);
		expect(() => getPlace(db, b.id, p.id)).toThrow();
		expect(() =>
			updatePlace(db, b.id, p.id, {
				name: 'x',
				address: '',
				lat: null,
				lng: null,
				defaultCategoryId: null
			})
		).toThrow();
		expect(() => setPlaceArchived(db, b.id, p.id, true)).toThrow();
		expect(() =>
			createPlace(db, b.id, {
				name: 'B',
				address: '',
				lat: null,
				lng: null,
				defaultCategoryId: aCat.id
			})
		).toThrow();
	});
});

describe('validatePlaceInput', () => {
	it('requires a name and valid coordinates as a pair', () => {
		expect(validatePlaceInput({ name: '', lat: null, lng: null })).toBeTruthy();
		expect(validatePlaceInput({ name: 'A', lat: 95, lng: 2 })).toBeTruthy();
		expect(validatePlaceInput({ name: 'A', lat: 45, lng: null })).toBeTruthy();
		expect(validatePlaceInput({ name: 'A', lat: 45, lng: 2 })).toBeNull();
		expect(validatePlaceInput({ name: 'A', lat: null, lng: null })).toBeNull();
	});

	it('deletes a place for good; its expenses and recurring rules lose the place only', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const other = await makeUser(db);
		const courses = listBudgets(db, u.id, '2026-10-01')[0].categories[0];
		const p = createPlace(db, u.id, {
			name: 'Carrefour',
			address: '',
			lat: 48.85,
			lng: 2.35,
			defaultCategoryId: null
		});
		const expenseId = saveExpense(db, u.id, {
			date: '2026-10-02',
			totalCents: 1200,
			placeId: p.id,
			description: 'pain',
			splits: [{ categoryId: courses.id, amountCents: 1200 }],
			tags: []
		});
		const rule = createRule(db, u.id, {
			kind: 'expense',
			amountCents: 500,
			categoryId: courses.id,
			placeId: p.id,
			source: '',
			description: '',
			frequency: 'monthly',
			dayOfMonth: 1,
			startDate: '2099-01-01',
			endDate: null,
			active: true
		});

		expect(() => deletePlace(db, other.id, p.id)).toThrow();
		expect(getPlace(db, u.id, p.id).name).toBe('Carrefour');

		deletePlace(db, u.id, p.id);
		expect(() => getPlace(db, u.id, p.id)).toThrow();
		const e = getExpense(db, u.id, expenseId);
		expect(e.placeId).toBeNull();
		expect(e.totalCents).toBe(1200);
		expect(getRule(db, u.id, rule.id).placeId).toBeNull();
	});
});
