import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteIncome, listIncomes, listSources, saveIncome } from '$lib/server/incomes';
import { selectedPeriod } from '$lib/server/period';
import { parseId, requireUser } from '$lib/server/scope';
import { amount, date, str } from '$lib/server/forms';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const db = getDb();
	const period = selectedPeriod(url, user);
	return {
		period,
		incomes: listIncomes(db, user.id, { from: period.start, to: period.end }),
		sources: listSources(db, user.id)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const cents = amount(form, 'amount');
		const d = date(form, 'date');
		if (cents == null || cents <= 0) return fail(400, { error: t.expenses.amountPositive });
		if (!d) return fail(400, { error: t.common.invalidDate });
		const idRaw = str(form, 'id');
		saveIncome(
			getDb(),
			user.id,
			{
				date: d,
				amountCents: cents,
				source: str(form, 'source', 100),
				description: str(form, 'description', 1000)
			},
			idRaw ? parseId(idRaw) : undefined
		);
		return { success: t.incomes.saved };
	},
	delete: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		deleteIncome(getDb(), user.id, parseId(str(form, 'id')));
		return { success: t.incomes.deleted };
	}
};
