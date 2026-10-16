import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteExpense, getExpense } from '$lib/server/expenses';
import { deletePhotoFiles } from '$lib/server/photos';
import { parseId, requireUser } from '$lib/server/scope';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	const user = requireUser(locals);
	return { expense: getExpense(getDb(), user.id, parseId(params.id)) };
};

export const actions: Actions = {
	delete: ({ locals, params }) => {
		const user = requireUser(locals);
		const files = deleteExpense(getDb(), user.id, parseId(params.id));
		deletePhotoFiles(user.id, files);
		redirect(303, '/depenses');
	}
};
