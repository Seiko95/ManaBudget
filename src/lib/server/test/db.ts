import { createDb, type DB } from '../db';
import { createUser } from '../users';

/** A fresh, migrated in-memory database. */
export function testDb(): DB {
	return createDb(':memory:');
}

let counter = 0;

/** Creates a user (with the French starter set) and returns its row. */
export async function makeUser(db: DB, opts: { isAdmin?: boolean; monthStartDay?: number } = {}) {
	counter++;
	return createUser(db, {
		username: `user${counter}`,
		password: 'motdepasse123',
		displayName: `Utilisateur ${counter}`,
		isAdmin: opts.isAdmin ?? false,
		monthStartDay: opts.monthStartDay
	});
}
