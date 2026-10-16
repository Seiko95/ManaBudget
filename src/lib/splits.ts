import { formatCents } from './format';
import { t } from './i18n/fr';

export type SplitInput = { categoryId: number | null; amountCents: number | null };

/** Every expense has ≥1 split; splits are all > 0 and sum to the total. Returns an error message or null. */
export function validateSplits(totalCents: number, splits: SplitInput[]): string | null {
	if (!Number.isInteger(totalCents) || totalCents <= 0) return t.expenses.amountPositive;
	if (splits.length === 0) return t.expenses.categoryRequired;
	for (const s of splits) {
		if (s.categoryId == null) return t.expenses.categoryRequired;
		if (s.amountCents == null || !Number.isInteger(s.amountCents) || s.amountCents <= 0)
			return t.expenses.splitPositive;
	}
	const rest = remainingCents(totalCents, splits);
	if (rest !== 0) return t.expenses.splitMismatch.replace('{amount}', formatCents(rest));
	return null;
}

export function remainingCents(
	totalCents: number,
	splits: { amountCents: number | null }[]
): number {
	return totalCents - splits.reduce((s, x) => s + (x.amountCents ?? 0), 0);
}
