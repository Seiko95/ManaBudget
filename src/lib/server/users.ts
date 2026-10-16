import { count, eq } from 'drizzle-orm';
import type { DB } from './db';
import { sessions, users, type User } from './db/schema';
import { hashPassword } from './password';
import { seedStarterData } from './seed';
import { t } from '../i18n/fr';

export type NewUserInput = {
	username: string;
	password: string;
	displayName: string;
	isAdmin?: boolean;
	monthStartDay?: number;
};

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeUsername(s: string): string {
	return s.trim().toLowerCase();
}

export function validatePassword(password: string): string | null {
	return password.length >= MIN_PASSWORD_LENGTH ? null : t.auth.passwordTooShort;
}

/** Returns an error message, or null when valid. */
export function validateNewUser(input: NewUserInput): string | null {
	const username = normalizeUsername(input.username);
	if (!/^[a-z0-9._-]{3,32}$/.test(username)) return t.auth.usernameInvalid;
	if (!input.displayName.trim()) return t.auth.displayNameRequired;
	return validatePassword(input.password);
}

export function countUsers(db: DB): number {
	return db.select({ n: count() }).from(users).get()?.n ?? 0;
}

export function findUserByUsername(db: DB, username: string): User | undefined {
	return db
		.select()
		.from(users)
		.where(eq(users.username, normalizeUsername(username)))
		.get();
}

/** Creates a user and their French starter set in one transaction. */
export async function createUser(db: DB, input: NewUserInput): Promise<User> {
	const passwordHash = await hashPassword(input.password);
	return db.transaction((tx) => {
		const user = tx
			.insert(users)
			.values({
				username: normalizeUsername(input.username),
				passwordHash,
				displayName: input.displayName.trim(),
				isAdmin: input.isAdmin ?? false,
				monthStartDay: input.monthStartDay ?? 1
			})
			.returning()
			.get();
		seedStarterData(tx as unknown as DB, user.id);
		return user;
	});
}

export function listUsers(db: DB) {
	return db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			isAdmin: users.isAdmin,
			disabled: users.disabled,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(users.id)
		.all();
}

export function getUser(db: DB, id: number): User | undefined {
	return db.select().from(users).where(eq(users.id, id)).get();
}

export async function resetPassword(db: DB, userId: number, password: string) {
	const passwordHash = await hashPassword(password);
	db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
	db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function setDisabled(db: DB, userId: number, disabled: boolean) {
	db.update(users).set({ disabled }).where(eq(users.id, userId)).run();
	if (disabled) db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

/** Deletes the account; every user-owned row cascades. Photo files are removed by the caller. */
export function deleteUser(db: DB, userId: number) {
	db.delete(users).where(eq(users.id, userId)).run();
}
