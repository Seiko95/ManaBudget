import { error, json, redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	SESSION_COOKIE,
	deleteSessionCookie,
	setSessionCookie,
	validateSessionToken
} from '$lib/server/auth';
import { countUsers } from '$lib/server/users';
import { materializeDue } from '$lib/server/recurring';

function runRecurring() {
	try {
		materializeDue(getDb());
	} catch (e) {
		console.error('Recurring materialization failed', e);
	}
}

export const init: ServerInit = () => {
	// Opening the database applies pending migrations.
	getDb();
	runRecurring();
	setInterval(runRecurring, 60 * 60 * 1000).unref();
};

const PUBLIC_PATHS = new Set(['/api/health', '/login', '/logout', '/setup']);

// Once a user exists there is always one (the admin cannot delete themself).
let hasUsers = false;
function anyUser(): boolean {
	if (!hasUsers) hasUsers = countUsers(getDb()) > 0;
	return hasUsers;
}

export const handle: Handle = async ({ event, resolve }) => {
	const db = getDb();
	event.locals.user = null;
	event.locals.session = null;

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const { session, user, fresh } = validateSessionToken(db, token);
		if (session) {
			event.locals.user = user;
			event.locals.session = session;
			if (fresh)
				setSessionCookie(event.cookies, token, session.expiresAt, event.url.protocol === 'https:');
		} else {
			deleteSessionCookie(event.cookies);
		}
	}

	const path = event.url.pathname;
	const isApi = path.startsWith('/api/');

	if (path !== '/api/health') {
		if (!anyUser()) {
			if (path !== '/setup') redirect(303, '/setup');
		} else if (!event.locals.user && !PUBLIC_PATHS.has(path)) {
			if (isApi || event.request.method !== 'GET')
				return json({ error: 'unauthorized' }, { status: 401 });
			const to = path + event.url.search;
			redirect(303, to === '/' ? '/login' : `/login?redirectTo=${encodeURIComponent(to)}`);
		}
		if ((path === '/admin' || path.startsWith('/admin/')) && !event.locals.user?.isAdmin)
			error(403, 'Accès réservé aux administrateurs');
	}

	return resolve(event);
};

/** Test hook. */
export function _resetUserCache() {
	hasUsers = false;
}
