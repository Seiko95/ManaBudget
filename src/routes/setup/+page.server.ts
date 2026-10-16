import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { countUsers, createUser, validateNewUser } from '$lib/server/users';
import { startSession } from '$lib/server/session';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (countUsers(getDb()) > 0) redirect(303, '/login');
};

export const actions: Actions = {
	default: async (event) => {
		const db = getDb();
		if (countUsers(db) > 0) redirect(303, '/login');
		const form = await event.request.formData();
		const input = {
			username: String(form.get('username') ?? ''),
			displayName: String(form.get('displayName') ?? ''),
			password: String(form.get('password') ?? ''),
			isAdmin: true
		};
		const values = { username: input.username, displayName: input.displayName };
		const err = validateNewUser(input);
		if (err) return fail(400, { error: err, values });
		if (input.password !== String(form.get('passwordConfirm') ?? ''))
			return fail(400, { error: t.auth.passwordMismatch, values });
		const user = await createUser(db, input);
		startSession(event, user.id);
		redirect(303, '/');
	}
};
