import { isIsoDate, isPeriodLabel, periodRange } from '../periods';
import { parseAmountToCents } from '../format';
import { currentPeriod } from './period';
import type { ExpenseFilters } from './expenses';

const posInt = (v: string | null) => {
	const n = Number(v);
	return v && Number.isInteger(n) && n > 0 ? n : undefined;
};

export type ParsedFilters = ExpenseFilters & {
	/** "YYYY-MM", "tout", or "dates" (custom from/to) */
	periode: string;
	active: number;
};

/**
 * Reads list filters from the URL: periode, du, au, budget, categorie,
 * lieu, etiquette, min, max, q. Defaults to the current period.
 */
export function parseExpenseFilters(url: URL, user: { monthStartDay: number }): ParsedFilters {
	const p = url.searchParams;
	const f: ParsedFilters = { periode: '', active: 0 };
	const du = p.get('du');
	const au = p.get('au');
	const periode = p.get('periode');
	if (isIsoDate(du) || isIsoDate(au)) {
		f.periode = 'dates';
		if (isIsoDate(du)) f.from = du;
		if (isIsoDate(au)) f.to = au;
	} else if (periode === 'tout') {
		f.periode = 'tout';
	} else {
		const label = isPeriodLabel(periode) ? periode : currentPeriod(user).label;
		const r = periodRange(label, user.monthStartDay);
		f.periode = label;
		f.from = r.start;
		f.to = r.end;
	}
	f.budgetId = posInt(p.get('budget'));
	f.categoryId = posInt(p.get('categorie'));
	f.placeId = posInt(p.get('lieu'));
	f.tagId = posInt(p.get('etiquette'));
	const min = parseAmountToCents(p.get('min'));
	const max = parseAmountToCents(p.get('max'));
	if (min != null && min >= 0) f.minCents = min;
	if (max != null && max >= 0) f.maxCents = max;
	const q = (p.get('q') ?? '').trim().slice(0, 100);
	if (q) f.q = q;
	f.active = [f.budgetId, f.categoryId, f.placeId, f.tagId, f.minCents, f.maxCents, f.q].filter(
		(x) => x !== undefined
	).length;
	return f;
}
