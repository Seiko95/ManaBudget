import { error } from '@sveltejs/kit';
import { and, asc, eq, lte, max } from 'drizzle-orm';
import type { DB } from './db';
import { expenses, expenseSplits, incomes, recurringRules, type RecurringRule } from './db/schema';
import { getCategory } from './budgets';
import { getPlace } from './places';
import { getExpense } from './expenses';
import { notFoundUnless, owned, ownedById } from './scope';
import { addDays, daysInMonth, isIsoDate, todayISO } from '../periods';
import { t } from '../i18n/fr';

export type Frequency = 'monthly' | 'weekly' | 'yearly';
export type Schedule = { frequency: Frequency; dayOfMonth: number; startDate: string };

export type RuleInput = {
	kind: 'expense' | 'income';
	amountCents: number;
	categoryId: number | null;
	placeId: number | null;
	source: string;
	description: string;
	frequency: Frequency;
	dayOfMonth: number;
	startDate: string;
	endDate: string | null;
	active: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Day `day` of the month, moved to the month's last day when it doesn't exist (29–31). */
function clampedDate(y: number, m: number, day: number): string {
	// m may overflow; normalise first
	const yy = y + Math.floor((m - 1) / 12);
	const mm = ((((m - 1) % 12) + 12) % 12) + 1;
	return `${yy}-${pad(mm)}-${pad(Math.min(day, daysInMonth(yy, mm)))}`;
}

const ymd = (d: string) => d.split('-').map(Number) as [number, number, number];

export function firstOccurrence(r: Schedule): string {
	const [y, m] = ymd(r.startDate);
	if (r.frequency === 'weekly') return r.startDate;
	if (r.frequency === 'monthly') {
		const c = clampedDate(y, m, r.dayOfMonth);
		return c >= r.startDate ? c : clampedDate(y, m + 1, r.dayOfMonth);
	}
	const c = clampedDate(y, m, r.dayOfMonth);
	return c >= r.startDate ? c : clampedDate(y + 1, m, r.dayOfMonth);
}

/** The occurrence following `date` (an occurrence of the rule). */
export function nextAfter(r: Schedule, date: string): string {
	const [y, m] = ymd(date);
	if (r.frequency === 'weekly') return addDays(date, 7);
	if (r.frequency === 'monthly') return clampedDate(y, m + 1, r.dayOfMonth);
	const [, sm] = ymd(r.startDate);
	return clampedDate(y + 1, sm, r.dayOfMonth);
}

/** First occurrence strictly after `date`. */
function firstAfter(r: Schedule, date: string): string {
	let d = firstOccurrence(r);
	while (d <= date) d = nextAfter(r, d);
	return d;
}

function validate(db: DB, userId: number, input: RuleInput) {
	if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
		error(400, t.expenses.amountPositive);
	if (!isIsoDate(input.startDate)) error(400, t.common.invalidDate);
	if (input.endDate && (!isIsoDate(input.endDate) || input.endDate < input.startDate))
		error(400, t.recurring.invalidEnd);
	if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 31)
		error(400, t.recurring.invalidDay);
	if (input.kind === 'expense') {
		if (input.categoryId == null) error(400, t.expenses.categoryRequired);
		getCategory(db, userId, input.categoryId);
		if (input.placeId != null) getPlace(db, userId, input.placeId);
	}
}

function values(input: RuleInput) {
	const isExpense = input.kind === 'expense';
	return {
		kind: input.kind,
		amountCents: input.amountCents,
		categoryId: isExpense ? input.categoryId : null,
		placeId: isExpense ? input.placeId : null,
		source: isExpense ? '' : input.source.trim().slice(0, 100),
		description: input.description.trim().slice(0, 1000),
		frequency: input.frequency,
		dayOfMonth: input.frequency === 'weekly' ? 1 : input.dayOfMonth,
		startDate: input.startDate,
		endDate: input.endDate || null,
		active: input.active
	};
}

export function createRule(db: DB, userId: number, input: RuleInput): RecurringRule {
	validate(db, userId, input);
	const v = values(input);
	return db
		.insert(recurringRules)
		.values({ userId, ...v, nextDueDate: firstOccurrence(v) })
		.returning()
		.get();
}

export function getRule(db: DB, userId: number, id: number): RecurringRule {
	return notFoundUnless(
		db
			.select()
			.from(recurringRules)
			.where(ownedById(recurringRules, userId, id))
			.get()
	);
}

function lastOccurrence(db: DB, ruleId: number): string | null {
	const e = db
		.select({ d: max(expenses.occurrenceDate) })
		.from(expenses)
		.where(eq(expenses.recurringRuleId, ruleId))
		.get()?.d;
	const i = db
		.select({ d: max(incomes.occurrenceDate) })
		.from(incomes)
		.where(eq(incomes.recurringRuleId, ruleId))
		.get()?.d;
	const all = [e, i].filter((x): x is string => !!x).sort();
	return all.at(-1) ?? null;
}

/** Updates a rule; its schedule continues after the last occurrence already created. */
export function updateRule(db: DB, userId: number, id: number, input: RuleInput) {
	getRule(db, userId, id);
	validate(db, userId, input);
	const v = values(input);
	const last = lastOccurrence(db, id);
	const nextDueDate = last ? firstAfter(v, last) : firstOccurrence(v);
	db.update(recurringRules)
		.set({ ...v, nextDueDate })
		.where(ownedById(recurringRules, userId, id))
		.run();
}

/** Deletes a rule; entries it already created are kept (their link is cleared). */
export function deleteRule(db: DB, userId: number, id: number) {
	getRule(db, userId, id);
	db.delete(recurringRules)
		.where(ownedById(recurringRules, userId, id))
		.run();
}

export function listRules(db: DB, userId: number): RecurringRule[] {
	return db
		.select()
		.from(recurringRules)
		.where(owned(recurringRules, userId))
		.orderBy(asc(recurringRules.kind), asc(recurringRules.nextDueDate))
		.all();
}

/**
 * "Rendre récurrente": a rule built from an expense. The expense itself is
 * linked as the occurrence for its date, so it isn't created twice.
 */
export function ruleFromExpense(
	db: DB,
	userId: number,
	expenseId: number,
	opts: { frequency: Frequency; endDate?: string | null }
): RecurringRule {
	const e = getExpense(db, userId, expenseId);
	if (e.recurringRuleId) error(400, t.recurring.alreadyRecurring);
	const [, , day] = ymd(e.date);
	return db.transaction((tx) => {
		const d = tx as unknown as DB;
		const input: RuleInput = {
			kind: 'expense',
			amountCents: e.totalCents,
			categoryId: e.splits[0].categoryId,
			placeId: e.placeId,
			source: '',
			description: e.description,
			frequency: opts.frequency,
			dayOfMonth: day,
			startDate: e.date,
			endDate: opts.endDate ?? null,
			active: true
		};
		validate(d, userId, input);
		const v = values(input);
		const rule = tx
			.insert(recurringRules)
			.values({ userId, ...v, nextDueDate: firstAfter(v, e.date) })
			.returning()
			.get();
		tx.update(expenses)
			.set({ recurringRuleId: rule.id, occurrenceDate: e.date })
			.where(ownedById(expenses, userId, expenseId))
			.run();
		return rule;
	});
}

/**
 * Creates every occurrence due up to today for active rules (all users, or one).
 * Idempotent: UNIQUE(recurring_rule_id, occurrence_date) makes a repeat a no-op.
 * Returns the number of entries created.
 */
export function materializeDue(db: DB, opts: { userId?: number; today?: string } = {}): number {
	const today = opts.today ?? todayISO();
	const due = db
		.select()
		.from(recurringRules)
		.where(
			and(
				eq(recurringRules.active, true),
				lte(recurringRules.nextDueDate, today),
				opts.userId != null ? eq(recurringRules.userId, opts.userId) : undefined
			)
		)
		.all();
	let created = 0;
	for (const rule of due) {
		db.transaction((tx) => {
			let date = rule.nextDueDate;
			while (date <= today && (!rule.endDate || date <= rule.endDate)) {
				if (rule.kind === 'expense' && rule.categoryId != null) {
					const row = tx
						.insert(expenses)
						.values({
							userId: rule.userId,
							date,
							totalCents: rule.amountCents,
							placeId: rule.placeId,
							description: rule.description,
							recurringRuleId: rule.id,
							occurrenceDate: date
						})
						.onConflictDoNothing()
						.returning({ id: expenses.id })
						.get();
					if (row) {
						tx.insert(expenseSplits)
							.values({
								userId: rule.userId,
								expenseId: row.id,
								categoryId: rule.categoryId,
								amountCents: rule.amountCents
							})
							.run();
						created++;
					}
				} else if (rule.kind === 'income') {
					const row = tx
						.insert(incomes)
						.values({
							userId: rule.userId,
							date,
							amountCents: rule.amountCents,
							source: rule.source,
							description: rule.description,
							recurringRuleId: rule.id,
							occurrenceDate: date
						})
						.onConflictDoNothing()
						.returning({ id: incomes.id })
						.get();
					if (row) created++;
				}
				date = nextAfter(rule, date);
			}
			tx.update(recurringRules)
				.set({ nextDueDate: date })
				.where(eq(recurringRules.id, rule.id))
				.run();
		});
	}
	return created;
}
