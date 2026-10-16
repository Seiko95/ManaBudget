import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createUser, countUsers, normalizeUsername, validateNewUser } from './users';
import { budgets, categories } from './db/schema';
import { STARTER_SET } from './seed';
import { testDb } from './test/db';

describe('createUser', () => {
	it('seeds the French starter set for every new user', async () => {
		const db = testDb();
		const u = await createUser(db, {
			username: 'Alice',
			password: 'motdepasse123',
			displayName: 'Alice',
			isAdmin: true
		});
		expect(u.username).toBe('alice');
		expect(countUsers(db)).toBe(1);
		const b = db.select().from(budgets).where(eq(budgets.userId, u.id)).all();
		expect(b.map((x) => x.name)).toEqual(STARTER_SET.map((x) => x.name));
		const c = db.select().from(categories).where(eq(categories.userId, u.id)).all();
		expect(c.map((x) => x.name)).toContain('Courses');
		expect(c.map((x) => x.name)).toContain('Transports en commun');
		// Budgets without sub-categories get one category of the same name
		const sante = b.find((x) => x.name === 'Santé')!;
		expect(c.filter((x) => x.budgetId === sante.id).map((x) => x.name)).toEqual(['Santé']);
		// Every budget gets a distinct colour
		expect(new Set(b.map((x) => x.color)).size).toBe(b.length);
	});

	it('rejects a duplicate username', async () => {
		const db = testDb();
		await createUser(db, { username: 'bob', password: 'motdepasse123', displayName: 'Bob' });
		await expect(
			createUser(db, { username: 'BOB', password: 'motdepasse123', displayName: 'Bob 2' })
		).rejects.toThrow();
	});
});

describe('validateNewUser', () => {
	it('checks username format and password length', () => {
		expect(normalizeUsername('  Jean.Dupont ')).toBe('jean.dupont');
		expect(
			validateNewUser({ username: 'ab', password: 'motdepasse123', displayName: 'x' })
		).toBeTruthy();
		expect(
			validateNewUser({ username: 'jean dupont', password: 'motdepasse123', displayName: 'x' })
		).toBeTruthy();
		expect(validateNewUser({ username: 'jean', password: 'court', displayName: 'x' })).toBeTruthy();
		expect(
			validateNewUser({ username: 'jean', password: 'motdepasse123', displayName: '' })
		).toBeTruthy();
		expect(
			validateNewUser({ username: 'jean', password: 'motdepasse123', displayName: 'Jean' })
		).toBeNull();
	});
});

describe('admin operations', () => {
	it('resets a password, disables and deletes a user with all their data', async () => {
		const { resetPassword, setDisabled, deleteUser, listUsers } = await import('./users');
		const { verifyPassword } = await import('./password');
		const { users } = await import('./db/schema');
		const db = testDb();
		const admin = await createUser(db, {
			username: 'admin',
			password: 'motdepasse123',
			displayName: 'Admin',
			isAdmin: true
		});
		const bob = await createUser(db, {
			username: 'bob',
			password: 'motdepasse123',
			displayName: 'Bob'
		});
		await resetPassword(db, bob.id, 'nouveaumdp456');
		const row = db.select().from(users).where(eq(users.id, bob.id)).get()!;
		expect(await verifyPassword(row.passwordHash, 'nouveaumdp456')).toBe(true);
		setDisabled(db, bob.id, true);
		expect(listUsers(db).find((u) => u.id === bob.id)?.disabled).toBe(true);
		deleteUser(db, bob.id);
		expect(listUsers(db).map((u) => u.id)).toEqual([admin.id]);
		expect(db.select().from(budgets).where(eq(budgets.userId, bob.id)).all()).toHaveLength(0);
	});
});
