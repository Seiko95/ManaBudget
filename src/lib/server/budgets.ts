import { and, asc, desc, eq, lte, max, sql } from 'drizzle-orm';
import type { DB } from './db';
import { budgetLimits, budgets, categories, type Budget, type Category } from './db/schema';
import { notFoundUnless, owned, ownedById } from './scope';

export type BudgetWithCategories = Budget & { limitCents: number; categories: Category[] };

export type BudgetInput = {
	name: string;
	color: string;
	icon: string;
	alertThreshold: number;
	limitCents: number;
	periodStart: string;
};

/** The limit in force for a period: the latest row with effective_from ≤ period start (0 = none). */
export function getLimitCents(db: DB, budgetId: number, periodStart: string): number {
	const row = db
		.select({ amount: budgetLimits.amountCents })
		.from(budgetLimits)
		.where(and(eq(budgetLimits.budgetId, budgetId), lte(budgetLimits.effectiveFrom, periodStart)))
		.orderBy(desc(budgetLimits.effectiveFrom))
		.limit(1)
		.get();
	return row?.amount ?? 0;
}

function limitSubquery(periodStart: string) {
	// Table-qualified on purpose: drizzle renders bare column names inside sql``.
	return sql<number>`coalesce((
		select bl.amount_cents from budget_limits bl
		where bl.budget_id = "budgets"."id" and bl.effective_from <= ${periodStart}
		order by bl.effective_from desc limit 1
	), 0)`;
}

export function listBudgets(
	db: DB,
	userId: number,
	periodStart: string,
	opts: { includeArchived?: boolean } = {}
): BudgetWithCategories[] {
	const rows = db
		.select({ budget: budgets, limitCents: limitSubquery(periodStart) })
		.from(budgets)
		.where(owned(budgets, userId, opts.includeArchived ? undefined : eq(budgets.archived, false)))
		.orderBy(asc(budgets.sortOrder), asc(budgets.id))
		.all();
	const cats = db
		.select()
		.from(categories)
		.where(
			owned(categories, userId, opts.includeArchived ? undefined : eq(categories.archived, false))
		)
		.orderBy(asc(categories.sortOrder), asc(categories.id))
		.all();
	return rows.map(({ budget, limitCents }) => ({
		...budget,
		limitCents,
		categories: cats.filter((c) => c.budgetId === budget.id)
	}));
}

export function getBudget(db: DB, userId: number, id: number): Budget {
	return notFoundUnless(
		db
			.select()
			.from(budgets)
			.where(ownedById(budgets, userId, id))
			.get()
	);
}

export function getCategory(db: DB, userId: number, id: number): Category {
	return notFoundUnless(
		db
			.select()
			.from(categories)
			.where(ownedById(categories, userId, id))
			.get()
	);
}

export function createBudget(db: DB, userId: number, input: BudgetInput): Budget {
	return db.transaction((tx) => {
		const next =
			(tx
				.select({ m: max(budgets.sortOrder) })
				.from(budgets)
				.where(owned(budgets, userId))
				.get()?.m ?? -1) + 1;
		const budget = tx
			.insert(budgets)
			.values({
				userId,
				name: input.name,
				color: input.color,
				icon: input.icon,
				alertThreshold: input.alertThreshold,
				sortOrder: next
			})
			.returning()
			.get();
		tx.insert(budgetLimits)
			.values({
				userId,
				budgetId: budget.id,
				effectiveFrom: input.periodStart,
				amountCents: input.limitCents
			})
			.run();
		return budget;
	});
}

export function updateBudget(
	db: DB,
	userId: number,
	id: number,
	patch: Partial<Pick<Budget, 'name' | 'color' | 'icon' | 'alertThreshold'>>
) {
	getBudget(db, userId, id);
	db.update(budgets)
		.set(patch)
		.where(ownedById(budgets, userId, id))
		.run();
}

/** Sets the limit from a period onwards; earlier periods keep their own limit. */
export function setLimit(
	db: DB,
	userId: number,
	budgetId: number,
	periodStart: string,
	cents: number
) {
	getBudget(db, userId, budgetId);
	db.insert(budgetLimits)
		.values({ userId, budgetId, effectiveFrom: periodStart, amountCents: cents })
		.onConflictDoUpdate({
			target: [budgetLimits.budgetId, budgetLimits.effectiveFrom],
			set: { amountCents: cents }
		})
		.run();
}

export function setBudgetArchived(db: DB, userId: number, id: number, archived: boolean) {
	getBudget(db, userId, id);
	db.update(budgets)
		.set({ archived })
		.where(ownedById(budgets, userId, id))
		.run();
}

/** Swaps a row's sort order with its neighbour. */
function move<T extends { id: number; sortOrder: number }>(
	rows: T[],
	id: number,
	dir: 'up' | 'down',
	save: (id: number, sortOrder: number) => void
) {
	const i = rows.findIndex((r) => r.id === id);
	const j = dir === 'up' ? i - 1 : i + 1;
	if (i < 0 || j < 0 || j >= rows.length) return;
	[rows[i], rows[j]] = [rows[j], rows[i]];
	rows.forEach((r, k) => save(r.id, k));
}

export function moveBudget(db: DB, userId: number, id: number, dir: 'up' | 'down') {
	getBudget(db, userId, id);
	db.transaction((tx) => {
		const rows = tx
			.select({ id: budgets.id, sortOrder: budgets.sortOrder })
			.from(budgets)
			.where(owned(budgets, userId, eq(budgets.archived, false)))
			.orderBy(asc(budgets.sortOrder), asc(budgets.id))
			.all();
		move(rows, id, dir, (rid, sortOrder) =>
			tx
				.update(budgets)
				.set({ sortOrder })
				.where(ownedById(budgets, userId, rid))
				.run()
		);
	});
}

export function createCategory(
	db: DB,
	userId: number,
	input: { budgetId: number; name: string; icon: string }
): Category {
	getBudget(db, userId, input.budgetId);
	const next =
		(db
			.select({ m: max(categories.sortOrder) })
			.from(categories)
			.where(owned(categories, userId, eq(categories.budgetId, input.budgetId)))
			.get()?.m ?? -1) + 1;
	return db
		.insert(categories)
		.values({
			userId,
			budgetId: input.budgetId,
			name: input.name,
			icon: input.icon,
			sortOrder: next
		})
		.returning()
		.get();
}

export function updateCategory(
	db: DB,
	userId: number,
	id: number,
	patch: Partial<Pick<Category, 'name' | 'icon' | 'budgetId'>>
) {
	getCategory(db, userId, id);
	if (patch.budgetId !== undefined) getBudget(db, userId, patch.budgetId);
	db.update(categories)
		.set(patch)
		.where(ownedById(categories, userId, id))
		.run();
}

export function setCategoryArchived(db: DB, userId: number, id: number, archived: boolean) {
	getCategory(db, userId, id);
	db.update(categories)
		.set({ archived })
		.where(ownedById(categories, userId, id))
		.run();
}

export function moveCategory(db: DB, userId: number, id: number, dir: 'up' | 'down') {
	const cat = getCategory(db, userId, id);
	db.transaction((tx) => {
		const rows = tx
			.select({ id: categories.id, sortOrder: categories.sortOrder })
			.from(categories)
			.where(
				owned(
					categories,
					userId,
					eq(categories.budgetId, cat.budgetId),
					eq(categories.archived, false)
				)
			)
			.orderBy(asc(categories.sortOrder), asc(categories.id))
			.all();
		move(rows, id, dir, (rid, sortOrder) =>
			tx
				.update(categories)
				.set({ sortOrder })
				.where(ownedById(categories, userId, rid))
				.run()
		);
	});
}

/** Active budgets with their active categories, for pickers. */
export function budgetOptions(db: DB, userId: number) {
	return listBudgets(db, userId, '9999-12-31').map((b) => ({
		id: b.id,
		name: b.name,
		icon: b.icon,
		color: b.color,
		categories: b.categories.map((c) => ({
			id: c.id,
			name: c.name,
			icon: c.icon,
			budgetId: c.budgetId
		}))
	}));
}
