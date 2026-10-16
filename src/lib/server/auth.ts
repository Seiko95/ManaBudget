import { createHash, randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { DB } from './db';
import { sessions, users, type Session, type User } from './db/schema';

export const SESSION_COOKIE = 'mb_session';
export const SESSION_DURATION_MS = 30 * 24 * 3600 * 1000;
const RENEW_THRESHOLD_MS = SESSION_DURATION_MS / 2;

export type SessionUser = Pick<
	User,
	'id' | 'username' | 'displayName' | 'isAdmin' | 'monthStartDay'
>;

export function generateSessionToken(): string {
	// 160 bits of entropy, URL-safe.
	return randomBytes(20).toString('base64url') + randomBytes(12).toString('base64url');
}

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createSession(db: DB, token: string, userId: number): Session {
	const session: Session = {
		id: hashToken(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
	};
	db.insert(sessions).values(session).run();
	return session;
}

export type SessionValidation =
	| { session: Session; user: SessionUser; fresh: boolean }
	| { session: null; user: null; fresh: false };

/** Looks up a session token; expired sessions are deleted, active ones renewed when half used. */
export function validateSessionToken(db: DB, token: string): SessionValidation {
	const id = hashToken(token);
	const row = db
		.select({
			session: sessions,
			user: {
				id: users.id,
				username: users.username,
				displayName: users.displayName,
				isAdmin: users.isAdmin,
				monthStartDay: users.monthStartDay,
				disabled: users.disabled
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return { session: null, user: null, fresh: false };
	const { session, user } = row;
	if (Date.now() >= session.expiresAt.getTime() || user.disabled) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return { session: null, user: null, fresh: false };
	}
	let fresh = false;
	if (session.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
		session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		db.update(sessions).set({ expiresAt: session.expiresAt }).where(eq(sessions.id, id)).run();
		fresh = true;
	}
	const { disabled: _disabled, ...sessionUser } = user;
	return { session, user: sessionUser, fresh };
}

export function invalidateSession(db: DB, sessionId: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function invalidateUserSessions(db: DB, userId: number) {
	db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function setSessionCookie(
	cookies: Cookies,
	token: string,
	expiresAt: Date,
	secure: boolean
) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		expires: expiresAt
	});
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
