import { error } from '@sveltejs/kit';
import { and, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

type Owned = { userId: SQLiteColumn; id?: SQLiteColumn };

/**
 * Every query on user-owned data goes through these helpers so it is always
 * filtered by the signed-in user's id.
 */
export function requireUser(locals: App.Locals) {
	if (!locals.user) error(401, 'Non connecté');
	return locals.user;
}

/** `user_id = :userId` (AND any extra conditions). */
export function owned(table: Owned, userId: number, ...extra: (SQL | undefined)[]): SQL {
	return and(eq(table.userId, userId), ...extra)!;
}

/** `user_id = :userId AND id = :id` */
export function ownedById(table: Owned & { id: SQLiteColumn }, userId: number, id: number): SQL {
	return and(eq(table.userId, userId), eq(table.id, id))!;
}

/** Parses a route/form id; 404 when not a positive integer. */
export function parseId(value: string | null | undefined): number {
	const n = Number(value);
	if (!Number.isInteger(n) || n <= 0) error(404, 'Introuvable');
	return n;
}

export function notFoundUnless<T>(row: T | undefined | null): T {
	if (!row) error(404, 'Introuvable');
	return row;
}
