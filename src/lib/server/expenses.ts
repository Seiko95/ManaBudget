import { error } from '@sveltejs/kit';
import { asc, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import type { DB } from './db';
import {
	budgets,
	categories,
	expenses,
	expenseSplits,
	expenseTags,
	photos,
	places,
	tags,
	type Expense,
	type Photo
} from './db/schema';
import { getCategory } from './budgets';
import { getPlace } from './places';
import { notFoundUnless, owned, ownedById } from './scope';
import { validateSplits } from '../splits';
import { BUDGET_PALETTE } from '../colors';
import { t } from '../i18n/fr';

export type ExpenseInput = {
	date: string;
	totalCents: number;
	placeId: number | null;
	description: string;
	splits: { categoryId: number; amountCents: number }[];
	tags: string[];
	recurringRuleId?: number | null;
	occurrenceDate?: string | null;
};

export type SplitView = {
	categoryId: number;
	categoryName: string;
	categoryIcon: string;
	budgetId: number;
	budgetName: string;
	budgetIcon: string;
	budgetColor: string;
	amountCents: number;
};

export type ListedExpense = {
	id: number;
	date: string;
	totalCents: number;
	description: string;
	placeId: number | null;
	placeName: string | null;
	recurringRuleId: number | null;
	splits: SplitView[];
	tags: { id: number; name: string; color: string }[];
	photoCount: number;
};

export type ExpenseFilters = {
	from?: string;
	to?: string;
	budgetId?: number;
	categoryId?: number;
	placeId?: number;
	tagId?: number;
	minCents?: number;
	maxCents?: number;
	q?: string;
	limit?: number;
};

const TAG_COLORS = BUDGET_PALETTE.map((c) => c.light);

/** Finds tags by name (case-insensitive) or creates them. Must run in a transaction. */
function resolveTags(db: DB, userId: number, names: string[]): number[] {
	const ids: number[] = [];
	const seen = new Set<string>();
	for (const raw of names) {
		const name = raw.trim().slice(0, 40);
		const key = name.toLowerCase();
		if (!name || seen.has(key)) continue;
		seen.add(key);
		const existing = db
			.select({ id: tags.id })
			.from(tags)
			.where(owned(tags, userId, sql`lower(${tags.name}) = ${key}`))
			.get();
		if (existing) {
			ids.push(existing.id);
			continue;
		}
		const count = db
			.select({ n: sql<number>`count(*)` })
			.from(tags)
			.where(owned(tags, userId))
			.get()!.n;
		const row = db
			.insert(tags)
			.values({ userId, name, color: TAG_COLORS[count % TAG_COLORS.length] })
			.returning({ id: tags.id })
			.get();
		ids.push(row.id);
	}
	return ids;
}

/** Creates (or, with `id`, replaces) an expense with its splits and tags. Returns its id. */
export function saveExpense(db: DB, userId: number, input: ExpenseInput, id?: number): number {
	const err = validateSplits(input.totalCents, input.splits);
	if (err) error(400, err);
	return db.transaction((tx) => {
		const d = tx as unknown as DB;
		if (input.placeId != null) getPlace(d, userId, input.placeId);
		for (const s of input.splits) getCategory(d, userId, s.categoryId);
		const values = {
			date: input.date,
			totalCents: input.totalCents,
			placeId: input.placeId,
			description: input.description.trim().slice(0, 1000)
		};
		let expenseId: number;
		if (id != null) {
			notFoundUnless(
				tx
					.select({ id: expenses.id })
					.from(expenses)
					.where(ownedById(expenses, userId, id))
					.get()
			);
			tx.update(expenses)
				.set({ ...values, updatedAt: new Date() })
				.where(ownedById(expenses, userId, id))
				.run();
			tx.delete(expenseSplits)
				.where(owned(expenseSplits, userId, eq(expenseSplits.expenseId, id)))
				.run();
			tx.delete(expenseTags)
				.where(owned(expenseTags, userId, eq(expenseTags.expenseId, id)))
				.run();
			expenseId = id;
		} else {
			expenseId = tx
				.insert(expenses)
				.values({
					userId,
					...values,
					recurringRuleId: input.recurringRuleId ?? null,
					occurrenceDate: input.occurrenceDate ?? null
				})
				.returning({ id: expenses.id })
				.get().id;
		}
		tx.insert(expenseSplits)
			.values(
				input.splits.map((s) => ({
					userId,
					expenseId,
					categoryId: s.categoryId,
					amountCents: s.amountCents
				}))
			)
			.run();
		const tagIds = resolveTags(d, userId, input.tags);
		if (tagIds.length)
			tx.insert(expenseTags)
				.values(tagIds.map((tagId) => ({ userId, expenseId, tagId })))
				.run();
		return expenseId;
	});
}

function splitsFor(db: DB, userId: number, expenseIds: number[]): Map<number, SplitView[]> {
	const map = new Map<number, SplitView[]>();
	if (!expenseIds.length) return map;
	const rows = db
		.select({
			expenseId: expenseSplits.expenseId,
			categoryId: categories.id,
			categoryName: categories.name,
			categoryIcon: categories.icon,
			budgetId: budgets.id,
			budgetName: budgets.name,
			budgetIcon: budgets.icon,
			budgetColor: budgets.color,
			amountCents: expenseSplits.amountCents
		})
		.from(expenseSplits)
		.innerJoin(categories, eq(categories.id, expenseSplits.categoryId))
		.innerJoin(budgets, eq(budgets.id, categories.budgetId))
		.where(owned(expenseSplits, userId, inArray(expenseSplits.expenseId, expenseIds)))
		.orderBy(desc(expenseSplits.amountCents), asc(expenseSplits.id))
		.all();
	for (const { expenseId, ...s } of rows) {
		if (!map.has(expenseId)) map.set(expenseId, []);
		map.get(expenseId)!.push(s);
	}
	return map;
}

function tagsFor(db: DB, userId: number, expenseIds: number[]) {
	const map = new Map<number, { id: number; name: string; color: string }[]>();
	if (!expenseIds.length) return map;
	const rows = db
		.select({ expenseId: expenseTags.expenseId, id: tags.id, name: tags.name, color: tags.color })
		.from(expenseTags)
		.innerJoin(tags, eq(tags.id, expenseTags.tagId))
		.where(owned(expenseTags, userId, inArray(expenseTags.expenseId, expenseIds)))
		.orderBy(asc(tags.name))
		.all();
	for (const { expenseId, ...tag } of rows) {
		if (!map.has(expenseId)) map.set(expenseId, []);
		map.get(expenseId)!.push(tag);
	}
	return map;
}

export function filterConditions(userId: number, f: ExpenseFilters): SQL {
	const c: (SQL | undefined)[] = [];
	if (f.from) c.push(gte(expenses.date, f.from));
	if (f.to) c.push(lte(expenses.date, f.to));
	if (f.placeId) c.push(eq(expenses.placeId, f.placeId));
	if (f.minCents != null) c.push(gte(expenses.totalCents, f.minCents));
	if (f.maxCents != null) c.push(lte(expenses.totalCents, f.maxCents));
	// Raw, table-qualified SQL: drizzle renders bare column names inside sql``.
	if (f.categoryId)
		c.push(
			sql`exists (select 1 from expense_splits s where s.expense_id = "expenses"."id" and s.category_id = ${f.categoryId})`
		);
	if (f.budgetId)
		c.push(
			sql`exists (select 1 from expense_splits s join categories c on c.id = s.category_id where s.expense_id = "expenses"."id" and c.budget_id = ${f.budgetId})`
		);
	if (f.tagId)
		c.push(
			sql`exists (select 1 from expense_tags et where et.expense_id = "expenses"."id" and et.tag_id = ${f.tagId})`
		);
	if (f.q?.trim()) {
		const like = `%${f.q
			.trim()
			.toLowerCase()
			.replace(/[%_\\]/g, (m) => '\\' + m)}%`;
		c.push(sql`(
			lower("expenses"."description") like ${like} escape '\\'
			or exists (select 1 from places p where p.id = "expenses"."place_id" and lower(p.name) like ${like} escape '\\')
			or exists (select 1 from expense_tags et join tags tg on tg.id = et.tag_id where et.expense_id = "expenses"."id" and lower(tg.name) like ${like} escape '\\')
			or exists (select 1 from expense_splits s join categories c on c.id = s.category_id where s.expense_id = "expenses"."id" and lower(c.name) like ${like} escape '\\')
		)`);
	}
	return owned(expenses, userId, ...c);
}

export function listExpenses(db: DB, userId: number, f: ExpenseFilters): ListedExpense[] {
	const rows = db
		.select({
			id: expenses.id,
			date: expenses.date,
			totalCents: expenses.totalCents,
			description: expenses.description,
			placeId: expenses.placeId,
			placeName: places.name,
			recurringRuleId: expenses.recurringRuleId,
			photoCount: sql<number>`(select count(*) from photos ph where ph.expense_id = "expenses"."id")`
		})
		.from(expenses)
		.leftJoin(places, eq(places.id, expenses.placeId))
		.where(filterConditions(userId, f))
		.orderBy(desc(expenses.date), desc(expenses.id))
		.limit(f.limit ?? 10_000)
		.all();
	const ids = rows.map((r) => r.id);
	const splits = splitsFor(db, userId, ids);
	const tagMap = tagsFor(db, userId, ids);
	return rows.map((r) => ({ ...r, splits: splits.get(r.id) ?? [], tags: tagMap.get(r.id) ?? [] }));
}

export function countAndSum(db: DB, userId: number, f: ExpenseFilters) {
	return db
		.select({
			n: sql<number>`count(*)`,
			total: sql<number>`coalesce(sum(${expenses.totalCents}), 0)`
		})
		.from(expenses)
		.where(filterConditions(userId, f))
		.get()!;
}

export type ExpenseDetail = Expense & {
	place: {
		id: number;
		name: string;
		address: string;
		lat: number | null;
		lng: number | null;
	} | null;
	splits: SplitView[];
	tags: { id: number; name: string; color: string }[];
	photos: Pick<Photo, 'id' | 'width' | 'height'>[];
};

export function getExpense(db: DB, userId: number, id: number): ExpenseDetail {
	const e = notFoundUnless(
		db
			.select()
			.from(expenses)
			.where(ownedById(expenses, userId, id))
			.get()
	);
	const place =
		e.placeId != null
			? (db
					.select({
						id: places.id,
						name: places.name,
						address: places.address,
						lat: places.lat,
						lng: places.lng
					})
					.from(places)
					.where(ownedById(places, userId, e.placeId))
					.get() ?? null)
			: null;
	return {
		...e,
		place,
		splits: splitsFor(db, userId, [id]).get(id) ?? [],
		tags: tagsFor(db, userId, [id]).get(id) ?? [],
		photos: db
			.select({ id: photos.id, width: photos.width, height: photos.height })
			.from(photos)
			.where(owned(photos, userId, eq(photos.expenseId, id)))
			.orderBy(asc(photos.id))
			.all()
	};
}

/** Deletes the expense; returns the photo files to remove from disk. */
export function deleteExpense(
	db: DB,
	userId: number,
	id: number
): { file: string; thumbFile: string }[] {
	notFoundUnless(
		db
			.select({ id: expenses.id })
			.from(expenses)
			.where(ownedById(expenses, userId, id))
			.get()
	);
	const files = db
		.select({ file: photos.file, thumbFile: photos.thumbFile })
		.from(photos)
		.where(owned(photos, userId, eq(photos.expenseId, id)))
		.all();
	db.delete(expenses)
		.where(ownedById(expenses, userId, id))
		.run();
	return files;
}

export function listTags(db: DB, userId: number) {
	return db
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(owned(tags, userId))
		.orderBy(asc(tags.name))
		.all();
}

export function assertTotal(totalCents: number | null): asserts totalCents is number {
	if (totalCents == null || totalCents <= 0) error(400, t.expenses.amountPositive);
}
