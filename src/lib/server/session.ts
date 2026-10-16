import type { RequestEvent } from '@sveltejs/kit';
import { getDb } from './db';
import { createSession, generateSessionToken, setSessionCookie } from './auth';

/** Creates a session for the user and sets the cookie. */
export function startSession(event: RequestEvent, userId: number) {
	const token = generateSessionToken();
	const session = createSession(getDb(), token, userId);
	setSessionCookie(event.cookies, token, session.expiresAt, event.url.protocol === 'https:');
}

/** Only allow same-site relative redirects after login. */
export function safeRedirect(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\'))
		return '/';
	return target;
}
