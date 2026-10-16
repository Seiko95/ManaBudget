import { describe, expect, it } from 'vitest';
import { parseExpenseFilters } from './expense-filters';

const u = (qs: string) => new URL('http://x/depenses?' + qs);

describe('parseExpenseFilters', () => {
	it('reads every filter from the query string', () => {
		const f = parseExpenseFilters(
			u('periode=2026-10&budget=3&categorie=4&lieu=5&etiquette=6&min=10&max=20,5&q=pain'),
			{ monthStartDay: 25 }
		);
		expect(f).toMatchObject({
			from: '2026-09-25',
			to: '2026-10-24',
			budgetId: 3,
			categoryId: 4,
			placeId: 5,
			tagId: 6,
			minCents: 1000,
			maxCents: 2050,
			q: 'pain',
			active: 7
		});
	});
	it('supports custom dates and "all dates", ignores junk', () => {
		expect(
			parseExpenseFilters(u('du=2026-01-01&au=2026-03-31'), { monthStartDay: 1 })
		).toMatchObject({ periode: 'dates', from: '2026-01-01', to: '2026-03-31' });
		const all = parseExpenseFilters(u('periode=tout&budget=abc&min=x'), { monthStartDay: 1 });
		expect(all.from).toBeUndefined();
		expect(all.budgetId).toBeUndefined();
		expect(all.minCents).toBeUndefined();
		expect(all.active).toBe(0);
	});
});
