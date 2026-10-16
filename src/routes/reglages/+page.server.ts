import { fail } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { sessions, users } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/scope';
import { int, str } from '$lib/server/forms';
import { getUser, validatePassword } from '$lib/server/users';
import { hashPassword, verifyPassword } from '$lib/server/password';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return { displayName: user.displayName, monthStartDay: user.monthStartDay };
};

export const actions: Actions = {
	profile: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const displayName = str(form, 'displayName', 60);
		if (!displayName) return fail(400, { error: t.auth.displayNameRequired });
		const monthStartDay = int(form, 'monthStartDay', user.monthStartDay, 1, 28);
		getDb().update(users).set({ displayName, monthStartDay }).where(eq(users.id, user.id)).run();
		return { success: t.settings.saved };
	},
	password: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const current = String(form.get('currentPassword') ?? '');
		const next = String(form.get('newPassword') ?? '');
		const db = getDb();
		const row = getUser(db, user.id)!;
		if (!(await verifyPassword(row.passwordHash, current)))
			return fail(400, { error: t.settings.wrongPassword });
		const err = validatePassword(next);
		if (err) return fail(400, { error: err });
		if (next !== String(form.get('newPasswordConfirm') ?? ''))
			return fail(400, { error: t.auth.passwordMismatch });
		db.update(users)
			.set({ passwordHash: await hashPassword(next) })
			.where(eq(users.id, user.id))
			.run();
		// Sign out every other device.
		db.delete(sessions)
			.where(and(eq(sessions.userId, user.id), ne(sessions.id, locals.session!.id)))
			.run();
		return { success: t.settings.passwordChanged };
	}
};
