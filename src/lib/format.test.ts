import { describe, expect, it } from 'vitest';
import {
	formatCents,
	parseAmountToCents,
	formatDistance,
	formatDay,
	formatPercent
} from './format';

const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('formatCents', () => {
	it('formats integer cents as French euros', () => {
		expect(nbsp(formatCents(123456))).toBe('1 234,56 €');
		expect(nbsp(formatCents(0))).toBe('0,00 €');
		expect(nbsp(formatCents(-500))).toBe('-5,00 €');
	});
});

describe('parseAmountToCents', () => {
	it('accepts comma or dot decimals and spaces', () => {
		expect(parseAmountToCents('12,5')).toBe(1250);
		expect(parseAmountToCents('12.34')).toBe(1234);
		expect(parseAmountToCents('1 234,56')).toBe(123456);
		expect(parseAmountToCents('7')).toBe(700);
		expect(parseAmountToCents(' 0,1 € ')).toBe(10);
	});
	it('rejects garbage and too many decimals', () => {
		expect(parseAmountToCents('')).toBeNull();
		expect(parseAmountToCents('abc')).toBeNull();
		expect(parseAmountToCents('1,234')).toBeNull();
		expect(parseAmountToCents('1,2,3')).toBeNull();
	});
	it('avoids float rounding errors', () => {
		expect(parseAmountToCents('0.29')).toBe(29);
		expect(parseAmountToCents('1.15')).toBe(115);
	});
});

describe('formatDistance', () => {
	it('uses metres under 1 km and km above', () => {
		expect(nbsp(formatDistance(120))).toBe('120 m');
		expect(nbsp(formatDistance(1530))).toBe('1,5 km');
	});
});

describe('formatDay / formatPercent', () => {
	it('formats a YYYY-MM-DD date in French', () => {
		expect(formatDay('2026-10-16')).toBe('vendredi 16 octobre 2026');
	});
	it('formats a percentage', () => {
		expect(nbsp(formatPercent(85))).toBe('85 %');
	});
});
