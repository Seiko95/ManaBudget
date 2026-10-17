import { and, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import type { DB } from './db';
import { categories, expenses, expenseSplits, incomes, places } from './db/schema';
import { owned } from './scope';
import { periodRange } from '../periods';

type Range = { from: string; to: string };

/** Spent per budget (cents) in a date range, from splits. */
export function spentByBudget(db: DB, userId: number, r: Range): Map<number, number> {
	const rows = db
		.select({
			budgetId: categories.budgetId,
			total: sql<number>`sum(${expenseSplits.amountCents})`
		})
		.from(expenseSplits)
		.innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
		.innerJoin(categories, eq(categories.id, expenseSplits.categoryId))
		.where(owned(expenseSplits, userId, gte(expenses.date, r.from), lte(expenses.date, r.to)))
		.groupBy(categories.budgetId)
		.all();
	return new Map(rows.map((x) => [x.budgetId, x.total]));
}

/** Spent per place (cents) in a date range. */
export function spentByPlace(db: DB, userId: number, r: Range): Map<number, number> {
	const rows = db
		.select({ placeId: expenses.placeId, total: sql<number>`sum(${expenses.totalCents})` })
		.from(expenses)
		.where(
			owned(
				expenses,
				userId,
				gte(expenses.date, r.from),
				lte(expenses.date, r.to),
				isNotNull(expenses.placeId)
			)
		)
		.groupBy(expenses.placeId)
		.all();
	return new Map(rows.map((x) => [x.placeId!, x.total]));
}

/** Spent per category (cents) in a date range, from splits. */
export function spentByCategory(db: DB, userId: number, r: Range): Map<number, number> {
	const rows = db
		.select({
			categoryId: expenseSplits.categoryId,
			total: sql<number>`sum(${expenseSplits.amountCents})`
		})
		.from(expenseSplits)
		.innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
		.where(owned(expenseSplits, userId, gte(expenses.date, r.from), lte(expenses.date, r.to)))
		.groupBy(expenseSplits.categoryId)
		.all();
	return new Map(rows.map((x) => [x.categoryId, x.total]));
}

function sumExpenses(db: DB, userId: number, r: Range): number {
	return (
		db
			.select({ s: sql<number>`coalesce(sum(${expenses.totalCents}), 0)` })
			.from(expenses)
			.where(owned(expenses, userId, gte(expenses.date, r.from), lte(expenses.date, r.to)))
			.get()?.s ?? 0
	);
}

function sumIncomes(db: DB, userId: number, r: Range): number {
	return (
		db
			.select({ s: sql<number>`coalesce(sum(${incomes.amountCents}), 0)` })
			.from(incomes)
			.where(owned(incomes, userId, gte(incomes.date, r.from), lte(incomes.date, r.to)))
			.get()?.s ?? 0
	);
}

export function periodTotals(db: DB, userId: number, r: Range) {
	return { income: sumIncomes(db, userId, r), expense: sumExpenses(db, userId, r) };
}

/** Income and expenses for each period label (oldest first). */
export function incomeVsExpense(db: DB, userId: number, labels: string[], startDay: number) {
	return labels.map((label) => {
		const p = periodRange(label, startDay);
		return { label, ...periodTotals(db, userId, { from: p.start, to: p.end }) };
	});
}

/** Spending per place that has GPS coordinates, biggest first. */
export function totalsByPlace(db: DB, userId: number, r: Range, limit = 50) {
	return db
		.select({
			placeId: places.id,
			name: places.name,
			lat: places.lat,
			lng: places.lng,
			total: sql<number>`sum(${expenses.totalCents})`,
			count: sql<number>`count(*)`
		})
		.from(expenses)
		.innerJoin(places, eq(places.id, expenses.placeId))
		.where(
			owned(
				expenses,
				userId,
				gte(expenses.date, r.from),
				lte(expenses.date, r.to),
				and(isNotNull(places.lat), isNotNull(places.lng))
			)
		)
		.groupBy(places.id)
		.orderBy(desc(sql`sum(${expenses.totalCents})`))
		.limit(limit)
		.all() as {
		placeId: number;
		name: string;
		lat: number;
		lng: number;
		total: number;
		count: number;
	}[];
}
