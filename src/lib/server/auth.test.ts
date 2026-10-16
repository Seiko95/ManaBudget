import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	createSession,
	generateSessionToken,
	hashToken,
	invalidateSession,
	validateSessionToken,
	SESSION_DURATION_MS
} from './auth';
import { hashPassword, verifyPassword } from './password';
import { sessions, users } from './db/schema';
import { makeUser, testDb } from './test/db';

describe('passwords', () => {
	it('hashes with argon2 and verifies', async () => {
		const h = await hashPassword('secret-pass');
		expect(h).toMatch(/^\$argon2id\$/);
		expect(await verifyPassword(h, 'secret-pass')).toBe(true);
		expect(await verifyPassword(h, 'wrong')).toBe(false);
	});
});

describe('sessions', () => {
	it('stores sha256(token) as id, never the token itself', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const token = generateSessionToken();
		const session = createSession(db, token, user.id);
		expect(session.id).toBe(hashToken(token));
		expect(session.id).not.toBe(token);
		expect(token.length).toBeGreaterThanOrEqual(32);
	});

	it('validates a live token and rejects unknown ones', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const token = generateSessionToken();
		createSession(db, token, user.id);
		const res = validateSessionToken(db, token);
		expect(res.user?.id).toBe(user.id);
		expect(validateSessionToken(db, generateSessionToken()).user).toBeNull();
	});

	it('deletes expired sessions', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const token = generateSessionToken();
		const s = createSession(db, token, user.id);
		db.update(sessions)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(sessions.id, s.id))
			.run();
		expect(validateSessionToken(db, token).user).toBeNull();
		expect(db.select().from(sessions).all()).toHaveLength(0);
	});

	it('renews a session that is past half its lifetime', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const token = generateSessionToken();
		const s = createSession(db, token, user.id);
		const soon = new Date(Date.now() + 5 * 24 * 3600 * 1000);
		db.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, s.id)).run();
		const res = validateSessionToken(db, token);
		expect(res.fresh).toBe(true);
		expect(res.session!.expiresAt.getTime()).toBeGreaterThan(
			Date.now() + SESSION_DURATION_MS - 60_000
		);
	});

	it('rejects sessions of disabled users', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const token = generateSessionToken();
		createSession(db, token, user.id);
		db.update(users).set({ disabled: true }).where(eq(users.id, user.id)).run();
		expect(validateSessionToken(db, token).user).toBeNull();
	});

	it('invalidates a session', async () => {
		const db = testDb();
		const user = await makeUser(db);
		const token = generateSessionToken();
		const s = createSession(db, token, user.id);
		invalidateSession(db, s.id);
		expect(validateSessionToken(db, token).user).toBeNull();
	});
});
