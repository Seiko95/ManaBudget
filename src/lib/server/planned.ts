import { asc, eq, gt, gte, inArray, lte } from 'drizzle-orm';
import type { DB } from './db';
import { categories, expenses, expenseSplits, incomes, places, recurringRules } from './db/schema';
import { owned } from './scope';
import { nextAfter } from './recurring';
import { todayISO } from '../periods';

export type PlannedItem = {
	date: string;
	kind: 'expense' | 'income';
	amountCents: number;
	label: string;
	/** Budget of the (first) category, for the colour dot. */
	budgetId: number | null;
	/** `entry`: an expense or income dated in the future; `rule`: an upcoming recurring occurrence. */
	origin: 'entry' | 'rule';
	/** The expense, income or rule it comes from. */
	refId: number;
};

export type Planned = {
	items: PlannedItem[];
	expense: number;
	income: number;
	byBudget: Map<number, number>;
};

/**
 * What is still to come in a period, after `today`: entries dated in the future and the
 * occurrences recurring rules will create (they are only materialized once due).
 */
export function plannedForPeriod(
	db: DB,
	userId: number,
	period: { start: string; end: string },
	today = todayISO()
): Planned {
	const out: Planned = { items: [], expense: 0, income: 0, byBudget: new Map() };
	if (period.end <= today) return out;
	const addBudget = (budgetId: number | null, cents: number) => {
		if (budgetId != null) out.byBudget.set(budgetId, (out.byBudget.get(budgetId) ?? 0) + cents);
	};
	const budgetOf = new Map(
		db
			.select({ id: categories.id, budgetId: categories.budgetId, name: categories.name })
			.from(categories)
			.where(owned(categories, userId))
			.all()
			.map((c) => [c.id, c])
	);

	// Expenses dated after today
	const future = db
		.select({
			id: expenses.id,
			date: expenses.date,
			totalCents: expenses.totalCents,
			description: expenses.description,
			placeName: places.name
		})
		.from(expenses)
		.leftJoin(places, eq(places.id, expenses.placeId))
		.where(
			owned(
				expenses,
				userId,
				gt(expenses.date, today),
				gte(expenses.date, period.start),
				lte(expenses.date, period.end)
			)
		)
		.orderBy(asc(expenses.date))
		.all();
	const splits = future.length
		? db
				.select()
				.from(expenseSplits)
				.where(
					owned(
						expenseSplits,
						userId,
						inArray(
							expenseSplits.expenseId,
							future.map((e) => e.id)
						)
					)
				)
				.orderBy(asc(expenseSplits.id))
				.all()
		: [];
	for (const e of future) {
		const own = splits.filter((s) => s.expenseId === e.id);
		for (const s of own) addBudget(budgetOf.get(s.categoryId)?.budgetId ?? null, s.amountCents);
		const first = own[0] && budgetOf.get(own[0].categoryId);
		out.items.push({
			date: e.date,
			kind: 'expense',
			amountCents: e.totalCents,
			label: e.description || e.placeName || first?.name || '',
			budgetId: first?.budgetId ?? null,
			origin: 'entry',
			refId: e.id
		});
		out.expense += e.totalCents;
	}

	// Income dated after today
	for (const i of db
		.select()
		.from(incomes)
		.where(
			owned(
				incomes,
				userId,
				gt(incomes.date, today),
				gte(incomes.date, period.start),
				lte(incomes.date, period.end)
			)
		)
		.all()) {
		out.items.push({
			date: i.date,
			kind: 'income',
			amountCents: i.amountCents,
			label: i.source || i.description,
			budgetId: null,
			origin: 'entry',
			refId: i.id
		});
		out.income += i.amountCents;
	}

	// Recurring occurrences not created yet
	for (const r of db
		.select()
		.from(recurringRules)
		.where(owned(recurringRules, userId, eq(recurringRules.active, true)))
		.all()) {
		const cat = r.categoryId != null ? budgetOf.get(r.categoryId) : undefined;
		if (r.kind === 'expense' && !cat) continue;
		for (
			let d = r.nextDueDate;
			d <= period.end && (!r.endDate || d <= r.endDate);
			d = nextAfter(r, d)
		) {
			if (d <= today || d < period.start) continue;
			if (r.kind === 'expense') {
				addBudget(cat!.budgetId, r.amountCents);
				out.expense += r.amountCents;
			} else out.income += r.amountCents;
			out.items.push({
				date: d,
				kind: r.kind,
				amountCents: r.amountCents,
				label: r.kind === 'expense' ? r.description || cat!.name : r.source || r.description,
				budgetId: cat?.budgetId ?? null,
				origin: 'rule',
				refId: r.id
			});
		}
	}

	out.items.sort((a, b) => a.date.localeCompare(b.date) || b.amountCents - a.amountCents);
	return out;
}
