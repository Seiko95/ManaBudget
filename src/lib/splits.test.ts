import { describe, expect, it } from 'vitest';
import { remainingCents, validateSplits } from './splits';

describe('validateSplits', () => {
	it('accepts one split equal to the total', () => {
		expect(validateSplits(1250, [{ categoryId: 1, amountCents: 1250 }])).toBeNull();
	});
	it('accepts several splits summing to the total', () => {
		expect(
			validateSplits(1000, [
				{ categoryId: 1, amountCents: 600 },
				{ categoryId: 2, amountCents: 400 }
			])
		).toBeNull();
	});
	it('rejects no splits, a mismatched sum, zero/negative amounts, a missing category, a zero total', () => {
		expect(validateSplits(1000, [])).toBeTruthy();
		expect(
			validateSplits(1000, [
				{ categoryId: 1, amountCents: 600 },
				{ categoryId: 2, amountCents: 300 }
			])
		).toMatch(/1,00/);
		expect(
			validateSplits(1000, [
				{ categoryId: 1, amountCents: 1000 },
				{ categoryId: 2, amountCents: 0 }
			])
		).toBeTruthy();
		expect(
			validateSplits(1000, [
				{ categoryId: 1, amountCents: 1100 },
				{ categoryId: 2, amountCents: -100 }
			])
		).toBeTruthy();
		expect(validateSplits(1000, [{ categoryId: null, amountCents: 1000 }])).toBeTruthy();
		expect(validateSplits(0, [{ categoryId: 1, amountCents: 0 }])).toBeTruthy();
	});
	it('computes what is left to split', () => {
		expect(remainingCents(1000, [{ amountCents: 300 }, { amountCents: null }])).toBe(700);
	});
});
