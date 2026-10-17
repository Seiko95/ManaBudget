import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, lte, max, sql } from 'drizzle-orm';
import type { DB } from './db';
import {
	budgetLimits,
	budgets,
	categories,
	expenseSplits,
	recurringRules,
	type Budget,
	type Category
} from './db/schema';
import { notFoundUnless, owned, ownedById } from './scope';
import { t } from '../i18n/fr';

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

export type Usage = { splits: number; rules: number };

/** How many expense splits and recurring rules point at each category, and per budget. */
export function categoryUsage(db: DB, userId: number) {
	const byCategory = new Map<number, Usage>();
	const bump = (id: number, key: keyof Usage, n: number) => {
		const u = byCategory.get(id) ?? { splits: 0, rules: 0 };
		u[key] += n;
		byCategory.set(id, u);
	};
	for (const r of db
		.select({ id: expenseSplits.categoryId, n: sql<number>`count(*)` })
		.from(expenseSplits)
		.where(owned(expenseSplits, userId))
		.groupBy(expenseSplits.categoryId)
		.all())
		bump(r.id, 'splits', r.n);
	for (const r of db
		.select({ id: recurringRules.categoryId, n: sql<number>`count(*)` })
		.from(recurringRules)
		.where(owned(recurringRules, userId))
		.groupBy(recurringRules.categoryId)
		.all())
		if (r.id != null) bump(r.id, 'rules', r.n);

	const byBudget = new Map<number, Usage>();
	for (const c of db
		.select({ id: categories.id, budgetId: categories.budgetId })
		.from(categories)
		.where(owned(categories, userId))
		.all()) {
		const u = byCategory.get(c.id);
		if (!u) continue;
		const b = byBudget.get(c.budgetId) ?? { splits: 0, rules: 0 };
		byBudget.set(c.budgetId, { splits: b.splits + u.splits, rules: b.rules + u.rules });
	}
	return { byCategory, byBudget };
}

/**
 * Moves everything filed under `ids` to `targetId` (required when anything is), so deleting
 * the categories never deletes expenses or recurring rules through the FK cascade. A split
 * whose expense already has a split on the target is merged into it.
 */
function moveOut(db: DB, userId: number, ids: number[], targetId: number | null) {
	if (targetId != null) {
		if (ids.includes(targetId)) error(400, t.budgets.replacementInvalid);
		getCategory(db, userId, targetId);
	}
	if (!ids.length) return;
	const splits = db
		.select()
		.from(expenseSplits)
		.where(owned(expenseSplits, userId, inArray(expenseSplits.categoryId, ids)))
		.all();
	const rules = db
		.select({ id: recurringRules.id })
		.from(recurringRules)
		.where(owned(recurringRules, userId, inArray(recurringRules.categoryId, ids)))
		.all();
	if (!splits.length && !rules.length) return;
	if (targetId == null) error(400, t.budgets.replacementRequired);

	for (const s of splits) {
		const existing = db
			.select()
			.from(expenseSplits)
			.where(
				owned(
					expenseSplits,
					userId,
					eq(expenseSplits.expenseId, s.expenseId),
					eq(expenseSplits.categoryId, targetId)
				)
			)
			.get();
		if (existing) {
			db.update(expenseSplits)
				.set({ amountCents: existing.amountCents + s.amountCents })
				.where(ownedById(expenseSplits, userId, existing.id))
				.run();
			db.delete(expenseSplits)
				.where(ownedById(expenseSplits, userId, s.id))
				.run();
		} else {
			db.update(expenseSplits)
				.set({ categoryId: targetId })
				.where(ownedById(expenseSplits, userId, s.id))
				.run();
		}
	}
	db.update(recurringRules)
		.set({ categoryId: targetId })
		.where(owned(recurringRules, userId, inArray(recurringRules.categoryId, ids)))
		.run();
}

/** Deletes a category for good, moving its expenses and recurring rules to `targetId` first. */
export function deleteCategory(db: DB, userId: number, id: number, targetId: number | null) {
	getCategory(db, userId, id);
	db.transaction((tx) => {
		const d = tx as unknown as DB;
		moveOut(d, userId, [id], targetId);
		d.delete(categories)
			.where(ownedById(categories, userId, id))
			.run();
	});
}

/** Deletes a budget with its categories and limits, moving their expenses and rules first. */
export function deleteBudget(db: DB, userId: number, id: number, targetId: number | null) {
	getBudget(db, userId, id);
	db.transaction((tx) => {
		const d = tx as unknown as DB;
		const ids = d
			.select({ id: categories.id })
			.from(categories)
			.where(owned(categories, userId, eq(categories.budgetId, id)))
			.all()
			.map((c) => c.id);
		moveOut(d, userId, ids, targetId);
		d.delete(budgets)
			.where(ownedById(budgets, userId, id))
			.run();
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
