import { error, fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	createUser,
	deleteUser,
	findUserByUsername,
	getUser,
	listUsers,
	resetPassword,
	setDisabled,
	validateNewUser,
	validatePassword
} from '$lib/server/users';
import { removeUserUploads } from '$lib/server/uploads';
import { parseId, requireUser } from '$lib/server/scope';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const me = requireUser(locals);
	if (!me.isAdmin) error(403);
	return { users: listUsers(getDb()), meId: me.id };
};

function targetUser(locals: App.Locals, form: FormData, allowSelf = false) {
	const me = requireUser(locals);
	if (!me.isAdmin) error(403);
	const id = parseId(String(form.get('id')));
	if (!allowSelf && id === me.id) error(400, t.admin.notSelf);
	const user = getUser(getDb(), id);
	if (!user) error(404);
	return user;
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const me = requireUser(locals);
		if (!me.isAdmin) error(403);
		const form = await request.formData();
		const input = {
			username: String(form.get('username') ?? ''),
			displayName: String(form.get('displayName') ?? ''),
			password: String(form.get('password') ?? ''),
			isAdmin: form.get('isAdmin') === 'on'
		};
		const values = { username: input.username, displayName: input.displayName };
		const err = validateNewUser(input);
		if (err) return fail(400, { action: 'create', error: err, values });
		const db = getDb();
		if (findUserByUsername(db, input.username))
			return fail(400, { action: 'create', error: t.auth.usernameTaken, values });
		await createUser(db, input);
		return { action: 'create', success: t.admin.created };
	},
	reset: async ({ request, locals }) => {
		const form = await request.formData();
		const user = targetUser(locals, form, true);
		const password = String(form.get('password') ?? '');
		const err = validatePassword(password);
		if (err) return fail(400, { action: 'reset', error: err, id: user.id });
		await resetPassword(getDb(), user.id, password);
		return { action: 'reset', success: t.admin.passwordReset };
	},
	toggle: async ({ request, locals }) => {
		const user = targetUser(locals, await request.formData());
		setDisabled(getDb(), user.id, !user.disabled);
		return { action: 'toggle', success: user.disabled ? t.admin.enabled : t.admin.disabled };
	},
	delete: async ({ request, locals }) => {
		const user = targetUser(locals, await request.formData());
		deleteUser(getDb(), user.id);
		removeUserUploads(user.id);
		return { action: 'delete', success: t.admin.deleted };
	}
};
