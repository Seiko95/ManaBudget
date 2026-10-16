import { error } from '@sveltejs/kit';
import { desc, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { DB } from './db';
import { incomes, type Income } from './db/schema';
import { notFoundUnless, owned, ownedById } from './scope';
import { t } from '../i18n/fr';

export type IncomeInput = {
	date: string;
	amountCents: number;
	source: string;
	description: string;
	recurringRuleId?: number | null;
	occurrenceDate?: string | null;
};

export function listIncomes(db: DB, userId: number, f: { from?: string; to?: string }): Income[] {
	const c: SQL[] = [];
	if (f.from) c.push(gte(incomes.date, f.from));
	if (f.to) c.push(lte(incomes.date, f.to));
	return db
		.select()
		.from(incomes)
		.where(owned(incomes, userId, ...c))
		.orderBy(desc(incomes.date), desc(incomes.id))
		.all();
}

export function getIncome(db: DB, userId: number, id: number): Income {
	return notFoundUnless(
		db
			.select()
			.from(incomes)
			.where(ownedById(incomes, userId, id))
			.get()
	);
}

export function saveIncome(db: DB, userId: number, input: IncomeInput, id?: number): number {
	if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
		error(400, t.expenses.amountPositive);
	const values = {
		date: input.date,
		amountCents: input.amountCents,
		source: input.source.trim().slice(0, 100),
		description: input.description.trim().slice(0, 1000)
	};
	if (id != null) {
		getIncome(db, userId, id);
		db.update(incomes)
			.set({ ...values, updatedAt: new Date() })
			.where(ownedById(incomes, userId, id))
			.run();
		return id;
	}
	return db
		.insert(incomes)
		.values({
			userId,
			...values,
			recurringRuleId: input.recurringRuleId ?? null,
			occurrenceDate: input.occurrenceDate ?? null
		})
		.returning({ id: incomes.id })
		.get().id;
}

export function deleteIncome(db: DB, userId: number, id: number) {
	getIncome(db, userId, id);
	db.delete(incomes)
		.where(ownedById(incomes, userId, id))
		.run();
}

/** Distinct past sources, most used first, for autocomplete. */
export function listSources(db: DB, userId: number): string[] {
	return db
		.select({ source: incomes.source })
		.from(incomes)
		.where(owned(incomes, userId, sql`${incomes.source} <> ''`))
		.groupBy(incomes.source)
		.orderBy(desc(sql`count(*)`), incomes.source)
		.limit(50)
		.all()
		.map((r) => r.source);
}
