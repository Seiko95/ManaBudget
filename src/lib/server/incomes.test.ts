import { describe, expect, it } from 'vitest';
import { deleteIncome, getIncome, listIncomes, listSources, saveIncome } from './incomes';
import { makeUser, testDb } from './test/db';

describe('incomes', () => {
	it('creates, lists by date range, updates and deletes', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const id = saveIncome(db, u.id, {
			date: '2026-10-01',
			amountCents: 250000,
			source: 'Salaire',
			description: ''
		});
		saveIncome(db, u.id, {
			date: '2026-09-15',
			amountCents: 3000,
			source: 'Vinted',
			description: 'Veste'
		});
		expect(
			listIncomes(db, u.id, { from: '2026-10-01', to: '2026-10-31' }).map((i) => i.source)
		).toEqual(['Salaire']);
		saveIncome(
			db,
			u.id,
			{ date: '2026-10-01', amountCents: 260000, source: 'Salaire', description: 'Prime' },
			id
		);
		expect(getIncome(db, u.id, id).amountCents).toBe(260000);
		expect(listSources(db, u.id)).toEqual(['Salaire', 'Vinted']);
		deleteIncome(db, u.id, id);
		expect(listIncomes(db, u.id, {})).toHaveLength(1);
	});

	it('rejects a non-positive amount', async () => {
		const db = testDb();
		const u = await makeUser(db);
		expect(() =>
			saveIncome(db, u.id, { date: '2026-10-01', amountCents: 0, source: '', description: '' })
		).toThrow();
	});

	it('isolates users', async () => {
		const db = testDb();
		const a = await makeUser(db);
		const b = await makeUser(db);
		const id = saveIncome(db, a.id, {
			date: '2026-10-01',
			amountCents: 100,
			source: 'Secret',
			description: ''
		});
		expect(listIncomes(db, b.id, {})).toHaveLength(0);
		expect(listSources(db, b.id)).toEqual([]);
		expect(() => getIncome(db, b.id, id)).toThrow();
		expect(() =>
			saveIncome(db, b.id, { date: '2026-10-01', amountCents: 1, source: '', description: '' }, id)
		).toThrow();
		expect(() => deleteIncome(db, b.id, id)).toThrow();
		expect(getIncome(db, a.id, id).amountCents).toBe(100);
	});
});
