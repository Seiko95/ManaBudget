/* eslint-disable @typescript-eslint/no-explicit-any -- fake RequestEvents */
/**
 * User isolation through the routes: user B must not be able to read or
 * modify user A's data via any page load, form action, API route or photo URL.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb, type DB } from './db';
import { testDb, makeUser } from './test/db';
import { listBudgets } from './budgets';
import { createPlace, getPlace } from './places';
import { saveExpense, getExpense } from './expenses';
import { addPhotos } from './photos';
import { saveIncome, getIncome } from './incomes';
import { createRule, getRule } from './recurring';
import type { SessionUser } from './auth';

import * as expenseApi from '../../routes/api/expenses/[id]/+server';
import * as expensesApi from '../../routes/api/expenses/+server';
import * as placeApi from '../../routes/api/places/[id]/+server';
import * as formApi from '../../routes/api/expense-form/+server';
import * as photoRoute from '../../routes/photos/[id]/+server';
import * as expenseDetail from '../../routes/depenses/[id]/+page.server';
import * as expenseList from '../../routes/depenses/+page.server';
import * as incomesPage from '../../routes/revenus/+page.server';
import * as recurringPage from '../../routes/recurrents/+page.server';
import * as budgetsPage from '../../routes/budgets/+page.server';
import * as placesPage from '../../routes/lieux/+page.server';
import * as dashboard from '../../routes/+page.server';
import * as statsPage from '../../routes/statistiques/+page.server';

let tmp: string;
let db: DB;
let A: SessionUser;
let B: SessionUser;
const ids = {} as Record<
	'expense' | 'photo' | 'place' | 'income' | 'rule' | 'budget' | 'category',
	number
>;

beforeAll(async () => {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-iso-'));
	process.env.DATA_DIR = tmp;
	db = testDb();
	setDb(db);
	const toSession = (u: Awaited<ReturnType<typeof makeUser>>): SessionUser => ({
		id: u.id,
		username: u.username,
		displayName: u.displayName,
		isAdmin: u.isAdmin,
		monthStartDay: u.monthStartDay
	});
	A = toSession(await makeUser(db));
	B = toSession(await makeUser(db));
	const budget = listBudgets(db, A.id, '2026-10-01')[0];
	ids.budget = budget.id;
	ids.category = budget.categories[0].id;
	ids.place = createPlace(db, A.id, {
		name: 'Secret A',
		address: '',
		lat: 1,
		lng: 1,
		defaultCategoryId: null
	}).id;
	const today = new Date().toISOString().slice(0, 10);
	ids.expense = saveExpense(db, A.id, {
		date: today,
		totalCents: 4242,
		placeId: ids.place,
		description: 'privé',
		splits: [{ categoryId: ids.category, amountCents: 4242 }],
		tags: ['secret-tag']
	});
	const img = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } })
		.jpeg()
		.toBuffer();
	ids.photo = (await addPhotos(db, A.id, ids.expense, [img]))[0].id;
	ids.income = saveIncome(db, A.id, {
		date: today,
		amountCents: 100000,
		source: 'Salaire A',
		description: ''
	});
	ids.rule = createRule(db, A.id, {
		kind: 'expense',
		amountCents: 500,
		categoryId: ids.category,
		placeId: null,
		source: '',
		description: 'règle A',
		frequency: 'monthly',
		dayOfMonth: 28,
		startDate: '2030-01-01',
		endDate: null,
		active: true
	}).id;
});

afterAll(() => {
	setDb(undefined);
	fs.rmSync(tmp, { recursive: true, force: true });
});

function event(
	user: SessionUser,
	opts: {
		params?: Record<string, string>;
		url?: string;
		form?: Record<string, string>;
		body?: BodyInit;
		method?: string;
	} = {}
) {
	const url = new URL(opts.url ?? 'http://localhost/');
	let request: Request;
	if (opts.form) {
		const fd = new FormData();
		for (const [k, v] of Object.entries(opts.form)) fd.set(k, v);
		request = new Request(url, { method: 'POST', body: fd });
	} else if (opts.body !== undefined) {
		request = new Request(url, {
			method: opts.method ?? 'POST',
			body: opts.body,
			headers: typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}
		});
	} else request = new Request(url, { method: opts.method ?? 'GET' });
	return {
		locals: { user, session: { id: 'x', userId: user.id, expiresAt: new Date() } },
		params: opts.params ?? {},
		url,
		request,
		cookies: { get: () => undefined, set() {}, delete() {} }
	} as any;
}

/** Resolves to the HTTP status a handler produced, whether it returned or threw. */
async function statusOf(fn: () => unknown): Promise<number> {
	try {
		const r = await fn();
		if (r instanceof Response) return r.status;
		return 200;
	} catch (e) {
		const s = (e as { status?: number }).status;
		if (typeof s === 'number') return s;
		throw e;
	}
}

function expenseForm() {
	const fd = new FormData();
	fd.set(
		'data',
		JSON.stringify({
			date: '2026-10-10',
			totalCents: 1,
			placeId: null,
			description: 'pwned',
			splits: [{ categoryId: ids.category, amountCents: 1 }],
			tags: []
		})
	);
	return fd;
}

describe('user B cannot reach user A’s data through the routes', () => {
	it('expense API: read, edit, delete, and filing under A’s category', async () => {
		const params = { id: String(ids.expense) };
		expect(await statusOf(() => expenseApi.GET(event(B, { params })))).toBe(404);
		expect(
			await statusOf(() => expenseApi.PUT(event(B, { params, body: expenseForm(), method: 'PUT' })))
		).toBe(404);
		expect(await statusOf(() => expenseApi.DELETE(event(B, { params, method: 'DELETE' })))).toBe(
			404
		);
		expect(await statusOf(() => expensesApi.POST(event(B, { body: expenseForm() })))).toBe(404);
	});

	it('photo route serves only the owner', async () => {
		const params = { id: String(ids.photo) };
		expect(
			await statusOf(() =>
				photoRoute.GET(event(B, { params, url: `http://localhost/photos/${ids.photo}` }))
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				photoRoute.GET(event(B, { params, url: `http://localhost/photos/${ids.photo}?thumb` }))
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				photoRoute.GET(event(A, { params, url: `http://localhost/photos/${ids.photo}` }))
			)
		).toBe(200);
	});

	it('place API and places page', async () => {
		const body = JSON.stringify({
			name: 'pwned',
			address: '',
			lat: null,
			lng: null,
			defaultCategoryId: null
		});
		expect(
			await statusOf(() =>
				placeApi.PUT(event(B, { params: { id: String(ids.place) }, body, method: 'PUT' }))
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				placesPage.actions.archive(event(B, { form: { id: String(ids.place), archived: 'true' } }))
			)
		).toBe(404);
		expect(
			await statusOf(() => placesPage.actions.delete(event(B, { form: { id: String(ids.place) } })))
		).toBe(404);
		const page = (await placesPage.load(
			event(B, { url: 'http://localhost/lieux?archives=1' })
		)) as { places: unknown[] };
		expect(page.places).toHaveLength(0);
	});

	it('expense pages and actions', async () => {
		const params = { id: String(ids.expense) };
		expect(await statusOf(() => expenseDetail.load(event(B, { params })))).toBe(404);
		expect(await statusOf(() => expenseDetail.actions.delete(event(B, { params, form: {} })))).toBe(
			404
		);
		expect(
			await statusOf(() =>
				expenseDetail.actions.makeRecurring(event(B, { params, form: { frequency: 'monthly' } }))
			)
		).toBe(404);
		const list = (await expenseList.load(
			event(B, { url: 'http://localhost/depenses?periode=tout' })
		)) as {
			expenses: unknown[];
			options: { places: unknown[]; tags: unknown[] };
		};
		expect(list.expenses).toHaveLength(0);
		expect(list.options.places).toHaveLength(0);
		expect(list.options.tags).toHaveLength(0);
		const form = (await (await formApi.GET(event(B))).json()) as {
			places: unknown[];
			tags: unknown[];
		};
		expect(form.places).toHaveLength(0);
		expect(form.tags).toHaveLength(0);
	});

	it('income, recurring and budget actions', async () => {
		expect(
			await statusOf(() =>
				incomesPage.actions.save(
					event(B, { form: { id: String(ids.income), amount: '1', date: '2026-10-10' } })
				)
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				incomesPage.actions.delete(event(B, { form: { id: String(ids.income) } }))
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				recurringPage.actions.delete(event(B, { form: { id: String(ids.rule) } }))
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				recurringPage.actions.save(
					event(B, {
						form: {
							id: String(ids.rule),
							kind: 'income',
							amount: '1',
							startDate: '2026-10-10',
							frequency: 'monthly',
							dayOfMonth: '1'
						}
					})
				)
			)
		).toBe(404);
		// Creating a rule on A's category is refused too
		expect(
			await statusOf(() =>
				recurringPage.actions.save(
					event(B, {
						form: {
							kind: 'expense',
							amount: '1',
							categoryId: String(ids.category),
							startDate: '2026-10-10',
							frequency: 'monthly',
							dayOfMonth: '1'
						}
					})
				)
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				budgetsPage.actions.saveBudget(
					event(B, { form: { id: String(ids.budget), name: 'pwned', limit: '1' } })
				)
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				budgetsPage.actions.archiveBudget(
					event(B, { form: { id: String(ids.budget), archived: 'true' } })
				)
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				budgetsPage.actions.moveBudget(event(B, { form: { id: String(ids.budget), dir: 'up' } }))
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				budgetsPage.actions.saveCategory(
					event(B, { form: { id: String(ids.category), name: 'x', budgetId: String(ids.budget) } })
				)
			)
		).toBe(404);
		expect(
			await statusOf(() =>
				budgetsPage.actions.archiveCategory(
					event(B, { form: { id: String(ids.category), archived: 'true' } })
				)
			)
		).toBe(404);
	});

	it('lists, dashboard and statistics show none of A’s numbers', async () => {
		const inc = (await incomesPage.load(event(B))) as { incomes: unknown[]; sources: unknown[] };
		expect(inc.incomes).toHaveLength(0);
		expect(inc.sources).toHaveLength(0);
		const rec = (await recurringPage.load(event(B))) as { rules: unknown[] };
		expect(rec.rules).toHaveLength(0);
		const dash = (await dashboard.load(event(B))) as {
			totals: { income: number; expense: number };
			latest: unknown[];
		};
		expect(dash.totals).toEqual({ income: 0, expense: 0 });
		expect(dash.latest).toHaveLength(0);
		const stats = (await statsPage.load(
			event(B, { url: 'http://localhost/statistiques?n=12' })
		)) as {
			budgets: unknown[];
			places: unknown[];
			trend: { income: number; expense: number }[];
		};
		expect(stats.budgets).toHaveLength(0);
		expect(stats.places).toHaveLength(0);
		expect(stats.trend.every((p) => p.income === 0 && p.expense === 0)).toBe(true);
	});

	it('A’s data is untouched afterwards', () => {
		const e = getExpense(db, A.id, ids.expense);
		expect(e.totalCents).toBe(4242);
		expect(e.description).toBe('privé');
		expect(e.photos).toHaveLength(1);
		expect(getIncome(db, A.id, ids.income).amountCents).toBe(100000);
		expect(getRule(db, A.id, ids.rule).description).toBe('règle A');
		expect(getPlace(db, A.id, ids.place).archived).toBe(false);
		const b = listBudgets(db, A.id, '2026-10-01', { includeArchived: true }).find(
			(x) => x.id === ids.budget
		)!;
		expect(b.name).not.toBe('pwned');
		expect(b.archived).toBe(false);
	});
});
