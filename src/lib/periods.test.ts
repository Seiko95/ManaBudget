import { describe, expect, it } from 'vitest';
import {
	periodFor,
	periodRange,
	prevPeriod,
	nextPeriod,
	periodLabelText,
	periodRangeText,
	periodsEndingAt,
	addDays,
	dateInRange
} from './periods';

describe('periodFor', () => {
	it('start day 1 = calendar month', () => {
		expect(periodFor('2026-10-16', 1)).toEqual({
			label: '2026-10',
			start: '2026-10-01',
			end: '2026-10-31'
		});
		expect(periodFor('2026-02-01', 1)).toEqual({
			label: '2026-02',
			start: '2026-02-01',
			end: '2026-02-28'
		});
		expect(periodFor('2028-02-29', 1).end).toBe('2028-02-29');
	});

	it('start day 25: labelled by the month holding most days (25 sept – 24 oct = Octobre)', () => {
		expect(periodFor('2026-09-25', 25)).toEqual({
			label: '2026-10',
			start: '2026-09-25',
			end: '2026-10-24'
		});
		expect(periodFor('2026-10-24', 25).label).toBe('2026-10');
		expect(periodFor('2026-10-25', 25)).toEqual({
			label: '2026-11',
			start: '2026-10-25',
			end: '2026-11-24'
		});
	});

	it('start day 15: labelled by the start month', () => {
		expect(periodFor('2026-10-14', 15)).toEqual({
			label: '2026-09',
			start: '2026-09-15',
			end: '2026-10-14'
		});
		expect(periodFor('2026-10-15', 15)).toEqual({
			label: '2026-10',
			start: '2026-10-15',
			end: '2026-11-14'
		});
		// February: 14 days in each month, still the start month, labels stay unique
		expect(periodFor('2026-02-20', 15).label).toBe('2026-02');
		expect(periodFor('2026-03-20', 15).label).toBe('2026-03');
	});

	it('start day 28', () => {
		expect(periodFor('2026-03-01', 28)).toEqual({
			label: '2026-03',
			start: '2026-02-28',
			end: '2026-03-27'
		});
		expect(periodFor('2026-03-28', 28)).toEqual({
			label: '2026-04',
			start: '2026-03-28',
			end: '2026-04-27'
		});
	});

	it('handles the year boundary', () => {
		expect(periodFor('2026-12-26', 25)).toEqual({
			label: '2027-01',
			start: '2026-12-25',
			end: '2027-01-24'
		});
		expect(periodFor('2027-01-10', 25).label).toBe('2027-01');
		expect(periodFor('2026-12-31', 1).label).toBe('2026-12');
		expect(periodFor('2027-01-05', 15)).toEqual({
			label: '2026-12',
			start: '2026-12-15',
			end: '2027-01-14'
		});
	});

	it('periods tile the calendar with no gaps or duplicate labels', () => {
		for (const startDay of [1, 5, 15, 16, 17, 25, 28]) {
			let d = '2025-01-01';
			const seen = new Set<string>();
			let prev = periodFor(d, startDay);
			seen.add(prev.label);
			while (d < '2027-12-31') {
				const p = periodFor(d, startDay);
				if (p.label !== prev.label) {
					expect(p.start).toBe(addDays(prev.end, 1));
					expect(seen.has(p.label)).toBe(false);
					seen.add(p.label);
				}
				expect(dateInRange(d, p)).toBe(true);
				prev = p;
				d = addDays(d, 1);
			}
		}
	});
});

describe('periodRange / prev / next', () => {
	it('round-trips with periodFor', () => {
		for (const startDay of [1, 15, 25, 28]) {
			const p = periodFor('2026-10-16', startDay);
			expect(periodRange(p.label, startDay)).toEqual(p);
		}
	});
	it('steps months across years', () => {
		expect(prevPeriod('2026-01')).toBe('2025-12');
		expect(nextPeriod('2026-12')).toBe('2027-01');
		expect(periodsEndingAt('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
	});
});

describe('display', () => {
	it('shows the month name and the date range', () => {
		expect(periodLabelText('2026-10')).toBe('Octobre 2026');
		expect(periodRangeText(periodRange('2026-10', 25))).toBe('25 sept. – 24 oct.');
		expect(periodRangeText(periodRange('2027-01', 25))).toBe('25 déc. 2026 – 24 janv. 2027');
	});
});
