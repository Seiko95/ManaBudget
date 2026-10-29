import { describe, expect, it } from 'vitest';
import {
	deleteTransfer,
	getTransfer,
	listTransfers,
	saveTransfer,
	savingsNet,
	savingsTotal,
	type SavingsInput
} from './savings';
import { periodTotals } from './stats';
import { makeUser, testDb } from './test/db';

const TODAY = '2026-10-17';
const input = (over: Partial<SavingsInput> = {}): SavingsInput => ({
	date: '2026-10-01',
	direction: 'deposit',
	amountCents: 10000,
	description: '',
	...over
});

describe('savings', () => {
	it('deposits add up, withdrawals take away, by date', async () => {
		const db = testDb();
		const u = await makeUser(db);
		saveTransfer(db, u.id, input({ date: '2026-09-01', amountCents: 20000 }), undefined, TODAY);
		saveTransfer(db, u.id, input({ date: '2026-10-01', amountCents: 5000 }), undefined, TODAY);
		saveTransfer(
			db,
			u.id,
			input({ date: '2026-10-10', direction: 'withdrawal', amountCents: 3000 }),
			undefined,
			TODAY
		);
		expect(savingsTotal(db, u.id)).toBe(22000);
		expect(savingsTotal(db, u.id, '2026-09-30')).toBe(20000);
		expect(savingsNet(db, u.id, { from: '2026-10-01', to: '2026-10-31' })).toBe(2000);
		expect(listTransfers(db, u.id).map((s) => s.date)).toEqual([
			'2026-10-10',
			'2026-10-01',
			'2026-09-01'
		]);
	});

	it('is not counted as income or spending', async () => {
		const db = testDb();
		const u = await makeUser(db);
		saveTransfer(db, u.id, input(), undefined, TODAY);
		expect(periodTotals(db, u.id, { from: '2026-10-01', to: '2026-10-31' })).toEqual({
			income: 0,
			expense: 0
		});
	});

	it('updates and deletes', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const id = saveTransfer(db, u.id, input(), undefined, TODAY);
		saveTransfer(db, u.id, input({ amountCents: 12345, description: 'Vacances' }), id, TODAY);
		expect(getTransfer(db, u.id, id)).toMatchObject({
			amountCents: 12345,
			description: 'Vacances'
		});
		deleteTransfer(db, u.id, id);
		expect(listTransfers(db, u.id)).toHaveLength(0);
	});

	it('rejects bad input, future dates and withdrawing more than was saved', async () => {
		const db = testDb();
		const u = await makeUser(db);
		const save = (over: Partial<SavingsInput>, id?: number) =>
			saveTransfer(db, u.id, input(over), id, TODAY);
		expect(() => save({ amountCents: 0 })).toThrow();
		expect(() => save({ date: '2026-02-30' })).toThrow();
		expect(() => save({ date: '2026-10-18' })).toThrow();
		expect(() => save({ direction: 'withdrawal' })).toThrow();
		const deposit = save({ amountCents: 5000 });
		const withdrawal = save({ direction: 'withdrawal', amountCents: 5000 });
		// Neither an edit nor a delete may leave savings below zero; nothing is written
		expect(() => save({ amountCents: 4000 }, deposit)).toThrow();
		expect(() => deleteTransfer(db, u.id, deposit)).toThrow();
		expect(savingsTotal(db, u.id)).toBe(0);
		deleteTransfer(db, u.id, withdrawal);
		expect(savingsTotal(db, u.id)).toBe(5000);
	});

	it('isolates users', async () => {
		const db = testDb();
		const a = await makeUser(db);
		const b = await makeUser(db);
		const id = saveTransfer(db, a.id, input(), undefined, TODAY);
		expect(listTransfers(db, b.id)).toHaveLength(0);
		expect(savingsTotal(db, b.id)).toBe(0);
		expect(() => getTransfer(db, b.id, id)).toThrow();
		expect(() => saveTransfer(db, b.id, input({ amountCents: 1 }), id, TODAY)).toThrow();
		expect(() => deleteTransfer(db, b.id, id)).toThrow();
		expect(getTransfer(db, a.id, id).amountCents).toBe(10000);
	});
});
