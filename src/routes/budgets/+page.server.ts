import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	createBudget,
	createCategory,
	listBudgets,
	moveBudget,
	moveCategory,
	setBudgetArchived,
	setCategoryArchived,
	setLimit,
	updateBudget,
	updateCategory
} from '$lib/server/budgets';
import { currentPeriod, selectedPeriod } from '$lib/server/period';
import { parseId, requireUser } from '$lib/server/scope';
import { amount, bool, color, int, str } from '$lib/server/forms';
import { BUDGET_PALETTE } from '$lib/colors';
import { isPeriodLabel, periodRange } from '$lib/periods';
import { t } from '$lib/i18n/fr';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals);
	const period = selectedPeriod(url, user);
	const showArchived = url.searchParams.get('archives') === '1';
	return {
		period,
		showArchived,
		budgets: listBudgets(getDb(), user.id, period.start, { includeArchived: showArchived })
	};
};

function periodStartFrom(form: FormData, user: { monthStartDay: number }) {
	const label = str(form, 'periode', 7);
	return isPeriodLabel(label)
		? periodRange(label, user.monthStartDay).start
		: currentPeriod(user).start;
}

function budgetFields(form: FormData) {
	const limitRaw = str(form, 'limit');
	const limitCents = limitRaw ? amount(form, 'limit') : 0;
	return {
		name: str(form, 'name', 60),
		icon: str(form, 'icon', 16),
		color: color(form, 'color', BUDGET_PALETTE[0].light),
		alertThreshold: int(form, 'alertThreshold', 80, 1, 100),
		limitCents
	};
}

export const actions: Actions = {
	saveBudget: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const f = budgetFields(form);
		if (!f.name) return fail(400, { error: t.budgets.nameRequired });
		if (f.limitCents === null || f.limitCents < 0)
			return fail(400, { error: t.common.invalidAmount });
		const periodStart = periodStartFrom(form, user);
		const db = getDb();
		const idRaw = str(form, 'id');
		if (idRaw) {
			const id = parseId(idRaw);
			updateBudget(db, user.id, id, {
				name: f.name,
				icon: f.icon,
				color: f.color,
				alertThreshold: f.alertThreshold
			});
			setLimit(db, user.id, id, periodStart, f.limitCents);
		} else {
			createBudget(db, user.id, { ...f, limitCents: f.limitCents, periodStart });
		}
		return { success: t.budgets.budgetSaved };
	},
	moveBudget: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		moveBudget(
			getDb(),
			user.id,
			parseId(str(form, 'id')),
			str(form, 'dir') === 'up' ? 'up' : 'down'
		);
	},
	archiveBudget: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const archived = bool(form, 'archived');
		setBudgetArchived(getDb(), user.id, parseId(str(form, 'id')), archived);
		return { success: archived ? t.budgets.archivedDone : t.budgets.unarchivedDone };
	},
	saveCategory: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const name = str(form, 'name', 60);
		const icon = str(form, 'icon', 16);
		const budgetId = parseId(str(form, 'budgetId'));
		if (!name) return fail(400, { error: t.budgets.nameRequired });
		const db = getDb();
		const idRaw = str(form, 'id');
		if (idRaw) updateCategory(db, user.id, parseId(idRaw), { name, icon, budgetId });
		else createCategory(db, user.id, { budgetId, name, icon });
		return { success: t.budgets.categorySaved };
	},
	moveCategory: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		moveCategory(
			getDb(),
			user.id,
			parseId(str(form, 'id')),
			str(form, 'dir') === 'up' ? 'up' : 'down'
		);
	},
	archiveCategory: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const archived = bool(form, 'archived');
		setCategoryArchived(getDb(), user.id, parseId(str(form, 'id')), archived);
		return { success: archived ? t.budgets.archivedDone : t.budgets.unarchivedDone };
	}
};
