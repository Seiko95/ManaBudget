import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { budgetOptions, listBudgets } from '$lib/server/budgets';
import { listPlaces } from '$lib/server/places';
import { listSources } from '$lib/server/incomes';
import {
	createRule,
	deleteRule,
	listRules,
	materializeDue,
	updateRule,
	type RuleInput
} from '$lib/server/recurring';
import { parseId, requireUser } from '$lib/server/scope';
import { amount, bool, date, int, optInt, str } from '$lib/server/forms';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	const db = getDb();
	const categoryNames = Object.fromEntries(
		listBudgets(db, user.id, '9999-12-31', { includeArchived: true }).flatMap((b) =>
			b.categories.map((c) => [c.id, { name: c.name, budget: b.name, color: b.color }])
		)
	);
	return {
		rules: listRules(db, user.id),
		budgets: budgetOptions(db, user.id),
		places: listPlaces(db, user.id, { includeArchived: true }).map((p) => ({
			id: p.id,
			name: p.name,
			archived: p.archived
		})),
		sources: listSources(db, user.id),
		categoryNames
	};
};

function readRule(form: FormData): RuleInput | string {
	const cents = amount(form, 'amount');
	if (cents == null || cents <= 0) return t.expenses.amountPositive;
	const startDate = date(form, 'startDate');
	if (!startDate) return t.common.invalidDate;
	const freq = str(form, 'frequency');
	return {
		kind: str(form, 'kind') === 'income' ? 'income' : 'expense',
		amountCents: cents,
		categoryId: optInt(form, 'categoryId'),
		placeId: optInt(form, 'placeId'),
		source: str(form, 'source', 100),
		description: str(form, 'description', 1000),
		frequency: freq === 'weekly' || freq === 'yearly' ? freq : 'monthly',
		dayOfMonth: int(form, 'dayOfMonth', 1, 1, 31),
		startDate,
		endDate: date(form, 'endDate'),
		active: bool(form, 'active')
	};
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const input = readRule(form);
		if (typeof input === 'string') return fail(400, { error: input });
		const db = getDb();
		const idRaw = str(form, 'id');
		if (idRaw) updateRule(db, user.id, parseId(idRaw), input);
		else createRule(db, user.id, input);
		// Create anything already due (e.g. a rule starting in the past)
		const n = materializeDue(db, { userId: user.id });
		return {
			success: n
				? `${t.recurring.saved} · ${t.recurring.created.replace('{n}', String(n))}`
				: t.recurring.saved
		};
	},
	delete: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		deleteRule(getDb(), user.id, parseId(str(form, 'id')));
		return { success: t.recurring.deleted };
	}
};
