import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb } from '.';

describe('createDb', () => {
	it('applies migrations to a fresh database', () => {
		const db = createDb(':memory:');
		const tables = db
			.all<{ name: string }>(sql`select name from sqlite_master where type = 'table'`)
			.map((r) => r.name);
		for (const t of ['users', 'sessions', 'budgets', 'expenses', 'expense_splits', 'photos'])
			expect(tables).toContain(t);
	});
	it('enforces foreign keys', () => {
		const db = createDb(':memory:');
		expect(db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`)?.foreign_keys).toBe(1);
	});
});
