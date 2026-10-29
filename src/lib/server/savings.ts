import { error } from '@sveltejs/kit';
import { desc, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { DB } from './db';
import { savingsTransfers, type SavingsTransfer } from './db/schema';
import { notFoundUnless, owned, ownedById } from './scope';
import { isIsoDate, todayISO } from '../periods';
import { formatCents } from '../format';
import { t } from '../i18n/fr';

export type SavingsDirection = SavingsTransfer['direction'];

export type SavingsInput = {
	date: string;
	direction: SavingsDirection;
	amountCents: number;
	description: string;
};

type Range = { from?: string; to?: string };

const signed = sql<number>`coalesce(sum(case when ${savingsTransfers.direction} = 'deposit' then ${savingsTransfers.amountCents} else -${savingsTransfers.amountCents} end), 0)`;

function rangeConditions(r: Range): SQL[] {
	const c: SQL[] = [];
	if (r.from) c.push(gte(savingsTransfers.date, r.from));
	if (r.to) c.push(lte(savingsTransfers.date, r.to));
	return c;
}

/** Deposits minus withdrawals in a date range (open-ended when a bound is missing). */
export function savingsNet(db: DB, userId: number, r: Range = {}): number {
	return (
		db
			.select({ s: signed })
			.from(savingsTransfers)
			.where(owned(savingsTransfers, userId, ...rangeConditions(r)))
			.get()?.s ?? 0
	);
}

/** What is in savings at the end of `date` (all transfers when omitted). */
export function savingsTotal(db: DB, userId: number, date?: string): number {
	return savingsNet(db, userId, { to: date });
}

export function listTransfers(db: DB, userId: number, r: Range = {}): SavingsTransfer[] {
	return db
		.select()
		.from(savingsTransfers)
		.where(owned(savingsTransfers, userId, ...rangeConditions(r)))
		.orderBy(desc(savingsTransfers.date), desc(savingsTransfers.id))
		.all();
}

export function getTransfer(db: DB, userId: number, id: number): SavingsTransfer {
	return notFoundUnless(
		db
			.select()
			.from(savingsTransfers)
			.where(ownedById(savingsTransfers, userId, id))
			.get()
	);
}

/** Savings can't go below zero: you can't withdraw more than you put in. */
function assertNotOverdrawn(db: DB, userId: number) {
	const total = savingsTotal(db, userId);
	if (total < 0) error(400, t.savings.overdrawn.replace('{amount}', formatCents(total)));
}

export function saveTransfer(
	db: DB,
	userId: number,
	input: SavingsInput,
	id?: number,
	today = todayISO()
): number {
	if (!Number.isInteger(input.amountCents) || input.amountCents <= 0)
		error(400, t.expenses.amountPositive);
	if (input.direction !== 'deposit' && input.direction !== 'withdrawal') error(400, t.common.error);
	if (!isIsoDate(input.date)) error(400, t.common.invalidDate);
	// Transfers are money that already moved, so they never sit in the "planned" part
	if (input.date > today) error(400, t.savings.noFuture);
	const values = {
		date: input.date,
		direction: input.direction,
		amountCents: input.amountCents,
		description: input.description.trim().slice(0, 1000)
	};
	return db.transaction((tx) => {
		const d = tx as unknown as DB;
		let savedId: number;
		if (id != null) {
			getTransfer(d, userId, id);
			d.update(savingsTransfers)
				.set({ ...values, updatedAt: new Date() })
				.where(ownedById(savingsTransfers, userId, id))
				.run();
			savedId = id;
		} else {
			savedId = d
				.insert(savingsTransfers)
				.values({ userId, ...values })
				.returning({ id: savingsTransfers.id })
				.get().id;
		}
		assertNotOverdrawn(d, userId);
		return savedId;
	});
}

export function deleteTransfer(db: DB, userId: number, id: number) {
	db.transaction((tx) => {
		const d = tx as unknown as DB;
		getTransfer(d, userId, id);
		d.delete(savingsTransfers)
			.where(ownedById(savingsTransfers, userId, id))
			.run();
		assertNotOverdrawn(d, userId);
	});
}
