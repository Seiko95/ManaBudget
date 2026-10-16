/* Dev helper: fills a data dir with a demo account and a year of data.
   DATA_DIR=test-data/demo npx tsx e2e/tools/seed-demo.ts */
import { createDb } from '../../src/lib/server/db/index.ts';
import { createUser } from '../../src/lib/server/users.ts';
import { listBudgets, setLimit } from '../../src/lib/server/budgets.ts';
import { createPlace } from '../../src/lib/server/places.ts';
import { saveExpense } from '../../src/lib/server/expenses.ts';
import { saveIncome } from '../../src/lib/server/incomes.ts';
import { createRule, materializeDue } from '../../src/lib/server/recurring.ts';
import { config } from '../../src/lib/server/config.ts';
import { addMonthsToLabel, periodRange, todayISO } from '../../src/lib/periods.ts';

const db = createDb(config.databasePath);
const user = await createUser(db, {
	username: 'demo',
	password: 'motdepasse-demo',
	displayName: 'Démo',
	isAdmin: true
});
const budgets = listBudgets(db, user.id, '2000-01-01');
const cat = Object.fromEntries(budgets.flatMap((b) => b.categories.map((c) => [c.name, c.id])));
const bud = Object.fromEntries(budgets.map((b) => [b.name, b.id]));
for (const [name, eur] of [
	['Alimentation', 450],
	['Transport', 180],
	['Loisirs', 150],
	['Shopping', 100],
	['Logement', 1100]
] as const)
	setLimit(db, user.id, bud[name], '2000-01-01', eur * 100);

const P = (name: string, lat: number, lng: number, c: string) =>
	createPlace(db, user.id, { name, address: `${name}, Lyon`, lat, lng, defaultCategoryId: cat[c] });
const places = [
	[P('Carrefour Part-Dieu', 45.7606, 4.8595, 'Courses'), 'Courses', 25, 90],
	[P('Lidl Guillotière', 45.7537, 4.8436, 'Courses'), 'Courses', 15, 60],
	[P('Boulangerie Paul', 45.764, 4.8357, 'Snacks & cafés'), 'Snacks & cafés', 3, 9],
	[P('Total Access', 45.7489, 4.8617, 'Carburant'), 'Carburant', 40, 75],
	[P('Bouchon Daniel et Denise', 45.7597, 4.8331, 'Restaurants'), 'Restaurants', 30, 70],
	[P('Cinéma Pathé', 45.7578, 4.8323, 'Sorties'), 'Sorties', 10, 28],
	[P('Decathlon', 45.7368, 4.8762, 'Sport'), 'Sport', 15, 120],
	[P('Pharmacie Bellecour', 45.7578, 4.832, 'Santé'), 'Santé', 5, 40]
] as const;

let seed = 42;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const today = todayISO();
const start = addMonthsToLabel(today.slice(0, 7), -11);
for (let m = 0; m < 12; m++) {
	const label = addMonthsToLabel(start, m);
	const r = periodRange(label, 1);
	for (let i = 0; i < 26; i++) {
		const [place, c, min, max] = places[Math.floor(rnd() * places.length)];
		const day = String(1 + Math.floor(rnd() * 28)).padStart(2, '0');
		const date = `${label}-${day}`;
		if (date > today || date < r.start) continue;
		const cents = Math.round((min + rnd() * (max - min)) * 100);
		saveExpense(db, user.id, {
			date,
			totalCents: cents,
			placeId: place.id,
			description: '',
			splits: [{ categoryId: cat[c], amountCents: cents }],
			tags: rnd() < 0.15 ? ['week-end'] : []
		});
	}
	if (rnd() < 0.5) {
		const date = `${label}-12`;
		if (date <= today)
			saveExpense(db, user.id, {
				date,
				totalCents: 4999,
				placeId: null,
				description: 'Cadeau',
				splits: [{ categoryId: cat['Cadeaux'], amountCents: 4999 }],
				tags: []
			});
	}
}
const first = `${start}-01`;
createRule(db, user.id, {
	kind: 'expense',
	amountCents: 95000,
	categoryId: cat['Loyer'],
	placeId: null,
	source: '',
	description: 'Loyer',
	frequency: 'monthly',
	dayOfMonth: 3,
	startDate: first,
	endDate: null,
	active: true
});
createRule(db, user.id, {
	kind: 'expense',
	amountCents: 1399,
	categoryId: cat['Abonnements'],
	placeId: null,
	source: '',
	description: 'Netflix',
	frequency: 'monthly',
	dayOfMonth: 15,
	startDate: first,
	endDate: null,
	active: true
});
createRule(db, user.id, {
	kind: 'income',
	amountCents: 265000,
	categoryId: null,
	placeId: null,
	source: 'Salaire',
	description: '',
	frequency: 'monthly',
	dayOfMonth: 28,
	startDate: first,
	endDate: null,
	active: true
});
saveIncome(db, user.id, {
	date: `${addMonthsToLabel(start, 5)}-10`,
	amountCents: 42000,
	source: 'Prime',
	description: ''
});
console.log('created', materializeDue(db), 'recurring entries');
