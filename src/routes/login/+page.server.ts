import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { findUserByUsername, normalizeUsername } from '$lib/server/users';
import { verifyPassword } from '$lib/server/password';
import { safeRedirect, startSession } from '$lib/server/session';
import { loginByIp, loginByUser } from '$lib/server/ratelimit';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirect(url.searchParams.get('redirectTo')));
};

// Verified against when the username is unknown, so timing doesn't reveal which usernames exist.
const DUMMY_HASH =
	'$argon2id$v=19$m=19456,t=2,p=1$4HWczoGbGyX55L57LFZxyg$6WHnTK8A724M1mVf8hq7LFJE8jtvFiTitVLI/iA+XWE';

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const username = normalizeUsername(String(form.get('username') ?? ''));
		const password = String(form.get('password') ?? '');
		const ip = event.getClientAddress();
		const ipKey = `ip:${ip}`;
		const userKey = `user:${username}`;

		const wait = Math.max(loginByIp.retryAfter(ipKey), loginByUser.retryAfter(userKey));
		if (wait > 0) {
			const minutes = String(Math.ceil(wait / 60000));
			return fail(429, { error: t.auth.tooManyAttempts.replace('{minutes}', minutes), username });
		}

		const user = findUserByUsername(getDb(), username);
		const ok = await verifyPassword(user?.passwordHash ?? DUMMY_HASH, password);
		if (!user || !ok || user.disabled) {
			loginByIp.fail(ipKey);
			loginByUser.fail(userKey);
			return fail(400, { error: t.auth.invalidCredentials, username });
		}
		loginByUser.reset(userKey);
		startSession(event, user.id);
		redirect(303, safeRedirect(event.url.searchParams.get('redirectTo')));
	}
};
