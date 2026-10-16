import type { DB } from './db';
import { budgetLimits, budgets, categories } from './db/schema';
import { BUDGET_PALETTE } from '../colors';

type StarterBudget = { name: string; icon: string; categories: string[] };

/** French starter set, created for every new user. No limit is set (0). */
export const STARTER_SET: StarterBudget[] = [
	{ name: 'Alimentation', icon: '🛒', categories: ['Courses', 'Restaurants', 'Snacks & cafés'] },
	{
		name: 'Logement',
		icon: '🏠',
		categories: ['Loyer', 'Énergie', 'Eau', 'Internet & téléphone', 'Assurance habitation']
	},
	{
		name: 'Transport',
		icon: '🚗',
		categories: [
			'Carburant',
			'Entretien',
			'Assurance auto',
			'Péage & parking',
			'Transports en commun'
		]
	},
	{ name: 'Santé', icon: '🩺', categories: [] },
	{ name: 'Loisirs', icon: '🎉', categories: ['Sorties', 'Abonnements', 'Sport', 'Voyages'] },
	{ name: 'Cadeaux', icon: '🎁', categories: [] },
	{ name: 'Shopping', icon: '🛍️', categories: [] },
	{ name: 'Divers', icon: '📦', categories: [] }
];

/** Must run inside the user-creation transaction. */
export function seedStarterData(db: DB, userId: number) {
	STARTER_SET.forEach((b, i) => {
		const budget = db
			.insert(budgets)
			.values({
				userId,
				name: b.name,
				icon: b.icon,
				color: BUDGET_PALETTE[i % BUDGET_PALETTE.length].light,
				sortOrder: i
			})
			.returning()
			.get();
		db.insert(budgetLimits)
			.values({ userId, budgetId: budget.id, effectiveFrom: '1970-01-01', amountCents: 0 })
			.run();
		// A budget without sub-categories gets one category with its own name,
		// since every expense is filed under a category.
		const names = b.categories.length ? b.categories : [b.name];
		db.insert(categories)
			.values(names.map((name, j) => ({ userId, budgetId: budget.id, name, sortOrder: j })))
			.run();
	});
}
