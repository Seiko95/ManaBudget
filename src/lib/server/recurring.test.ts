import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	createRule,
	deleteRule,
	firstOccurrence,
	listRules,
	materializeDue,
	nextAfter,
	ruleFromExpense,
	updateRule,
	type RuleInput
} from './recurring';
import { expenses, incomes, recurringRules } from './db/schema';
import { listBudgets } from './budgets';
import { saveExpense } from './expenses';
import { makeUser, testDb } from './test/db';
import type { DB } from './db';

const monthly = (day: number, start: string) =>
	({ frequency: 'monthly', dayOfMonth: day, startDate: start }) as const;

describe('occurrence dates', () => {
	it('monthly on the 31st is moved to the last day of shorter months', () => {
		const r = monthly(31, '2026-01-10');
		let d = firstOccurrence(r);
		const dates = [d];
		for (let i = 0; i < 4; i++) dates.push((d = nextAfter(r, d)));
		expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
		expect(nextAfter(monthly(30, '2028-01-01'), '2028-01-30')).toBe('2028-02-29');
	});
	it('monthly starts the same month when the day is still ahead, else next month', () => {
		expect(firstOccurrence(monthly(15, '2026-10-10'))).toBe('2026-10-15');
		expect(firstOccurrence(monthly(5, '2026-10-10'))).toBe('2026-11-05');
	});
	it('weekly repeats every 7 days from the start date, across years', () => {
		const r = { frequency: 'weekly', dayOfMonth: 1, startDate: '2026-12-24' } as const;
		expect(firstOccurrence(r)).toBe('2026-12-24');
		expect(nextAfter(r, '2026-12-24')).toBe('2026-12-31');
		expect(nextAfter(r, '2026-12-31')).toBe('2027-01-07');
	});
	it("yearly keeps the start date's month; 29 Feb falls back to 28 Feb", () => {
		const r = { frequency: 'yearly', dayOfMonth: 29, startDate: '2028-02-01' } as const;
		expect(firstOccurrence(r)).toBe('2028-02-29');
		expect(nextAfter(r, '2028-02-29')).toBe('2029-02-28');
		expect(nextAfter(r, '2031-02-28')).toBe('2032-02-29');
	});
});

async function setup() {
	const db = testDb();
	const u = await makeUser(db);
	const cat = listBudgets(db, u.id, '2026-10-01').find((b) => b.name === 'Logement')!.categories[0];
	return { db, u, cat };
}

function rule(over: Partial<RuleInput> & { categoryId?: number | null }): RuleInput {
	return {
		kind: 'expense',
		amountCents: 80000,
		categoryId: null,
		placeId: null,
		source: '',
		description: 'Loyer',
		frequency: 'monthly',
		dayOfMonth: 5,
		startDate: '2026-08-01',
		endDate: null,
		active: true,
		...over
	};
}

const count = (db: DB, table: typeof expenses | typeof incomes) =>
	db.select().from(table).all().length;

describe('materializeDue', () => {
	it('creates every occurrence due up to today, and is idempotent', async () => {
		const { db, u, cat } = await setup();
		createRule(db, u.id, rule({ categoryId: cat.id }));
		expect(materializeDue(db, { today: '2026-10-16' })).toBe(3); // Aug 5, Sep 5, Oct 5
		expect(materializeDue(db, { today: '2026-10-16' })).toBe(0);
		expect(count(db, expenses)).toBe(3);
		const rows = db.select().from(expenses).all();
		expect(rows.map((r) => r.date).sort()).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
		expect(rows.every((r) => r.occurrenceDate === r.date && r.recurringRuleId)).toBe(true);
		// Next run a month later adds exactly one
		expect(materializeDue(db, { today: '2026-11-05' })).toBe(1);
	});

	it('never duplicates even if next_due_date is rewound (unique index)', async () => {
		const { db, u, cat } = await setup();
		const r = createRule(db, u.id, rule({ categoryId: cat.id }));
		materializeDue(db, { today: '2026-10-16' });
		db.update(recurringRules)
			.set({ nextDueDate: '2026-08-05' })
			.where(eq(recurringRules.id, r.id))
			.run();
		materializeDue(db, { today: '2026-10-16' });
		expect(count(db, expenses)).toBe(3);
	});

	it('creates incomes, respects end date and inactive rules, scopes by user', async () => {
		const { db, u, cat } = await setup();
		const other = await makeUser(db);
		createRule(
			db,
			u.id,
			rule({
				kind: 'income',
				source: 'Salaire',
				amountCents: 200000,
				dayOfMonth: 28,
				startDate: '2026-09-01',
				endDate: '2026-09-30'
			})
		);
		createRule(db, u.id, rule({ categoryId: cat.id, active: false }));
		const otherCat = listBudgets(db, other.id, '2026-10-01')[0].categories[0];
		createRule(db, other.id, rule({ categoryId: otherCat.id }));
		expect(materializeDue(db, { today: '2026-12-01', userId: u.id })).toBe(1);
		expect(
			db
				.select()
				.from(incomes)
				.all()
				.map((i) => [i.date, i.source])
		).toEqual([['2026-09-28', 'Salaire']]);
		expect(count(db, expenses)).toBe(0); // inactive rule, and the other user's rule wasn't run
	});

	it('weekly and yearly rules', async () => {
		const { db, u, cat } = await setup();
		createRule(
			db,
			u.id,
			rule({ categoryId: cat.id, frequency: 'weekly', startDate: '2026-10-01' })
		);
		createRule(
			db,
			u.id,
			rule({ categoryId: cat.id, frequency: 'yearly', dayOfMonth: 15, startDate: '2025-03-01' })
		);
		materializeDue(db, { today: '2026-10-16' });
		const dates = db
			.select()
			.from(expenses)
			.all()
			.map((e) => e.date)
			.sort();
		expect(dates).toEqual(['2025-03-15', '2026-03-15', '2026-10-01', '2026-10-08', '2026-10-15']);
	});
});

describe('rules', () => {
	it('"Rendre récurrente": the original expense counts as the first occurrence', async () => {
		const { db, u, cat } = await setup();
		const id = saveExpense(db, u.id, {
			date: '2026-10-05',
			totalCents: 1299,
			placeId: null,
			description: 'Netflix',
			splits: [{ categoryId: cat.id, amountCents: 1299 }],
			tags: []
		});
		const r = ruleFromExpense(db, u.id, id, { frequency: 'monthly' });
		expect(r.nextDueDate).toBe('2026-11-05');
		expect(materializeDue(db, { today: '2026-10-20' })).toBe(0);
		expect(materializeDue(db, { today: '2026-11-05' })).toBe(1);
		expect(db.select().from(expenses).all()).toHaveLength(2);
	});

	it('editing a rule continues after the last occurrence; deleting keeps past entries', async () => {
		const { db, u, cat } = await setup();
		const r = createRule(db, u.id, rule({ categoryId: cat.id }));
		materializeDue(db, { today: '2026-10-16' });
		updateRule(db, u.id, r.id, rule({ categoryId: cat.id, amountCents: 85000 }));
		expect(listRules(db, u.id)[0].nextDueDate).toBe('2026-11-05');
		deleteRule(db, u.id, r.id);
		expect(listRules(db, u.id)).toHaveLength(0);
		expect(count(db, expenses)).toBe(3);
	});

	it('validates input and ownership', async () => {
		const { db, u, cat } = await setup();
		const other = await makeUser(db);
		expect(() => createRule(db, u.id, rule({ categoryId: null }))).toThrow(); // expense needs a category
		expect(() => createRule(db, other.id, rule({ categoryId: cat.id }))).toThrow(); // not their category
		const r = createRule(db, u.id, rule({ categoryId: cat.id }));
		expect(() => updateRule(db, other.id, r.id, rule({ categoryId: cat.id }))).toThrow();
		expect(() => deleteRule(db, other.id, r.id)).toThrow();
		expect(listRules(db, other.id)).toHaveLength(0);
	});
});
