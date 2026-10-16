import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteExpense, getExpense } from '$lib/server/expenses';
import { deletePhotoFiles } from '$lib/server/photos';
import { parseId, requireUser } from '$lib/server/scope';
import { ruleFromExpense } from '$lib/server/recurring';
import { date, str } from '$lib/server/forms';
import { t } from '$lib/i18n/fr';
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
	},
	makeRecurring: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const f = str(form, 'frequency');
		ruleFromExpense(getDb(), user.id, parseId(params.id), {
			frequency: f === 'weekly' || f === 'yearly' ? f : 'monthly',
			endDate: date(form, 'endDate')
		});
		return { success: t.recurring.madeRecurring };
	}
};
