import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	deleteTransfer,
	listTransfers,
	saveTransfer,
	savingsTotal,
	type SavingsDirection
} from '$lib/server/savings';
import { carryOver } from '$lib/server/balance';
import { parseId, requireUser } from '$lib/server/scope';
import { amount, date, str } from '$lib/server/forms';
import { addDays, todayISO } from '$lib/periods';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	const db = getDb();
	const today = todayISO();
	return {
		total: savingsTotal(db, user.id),
		// Everything up to today, as the dashboard's balance for the current period
		available: carryOver(db, user.id, addDays(today, 1), today).real,
		transfers: listTransfers(db, user.id)
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const cents = amount(form, 'amount');
		const d = date(form, 'date');
		const direction = str(form, 'direction', 20);
		if (cents == null || cents <= 0) return fail(400, { error: t.expenses.amountPositive });
		if (!d) return fail(400, { error: t.common.invalidDate });
		if (d > todayISO()) return fail(400, { error: t.savings.noFuture });
		if (direction !== 'deposit' && direction !== 'withdrawal')
			return fail(400, { error: t.common.error });
		const idRaw = str(form, 'id');
		saveTransfer(
			getDb(),
			user.id,
			{
				date: d,
				direction: direction as SavingsDirection,
				amountCents: cents,
				description: str(form, 'description', 1000)
			},
			idRaw ? parseId(idRaw) : undefined
		);
		return { success: t.savings.saved };
	},
	delete: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		deleteTransfer(getDb(), user.id, parseId(str(form, 'id')));
		return { success: t.savings.deleted };
	}
};
