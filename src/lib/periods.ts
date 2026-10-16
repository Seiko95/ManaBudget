/**
 * Monthly budget periods that start on a custom day (1–28), shared by client and server.
 *
 * A period is labelled "YYYY-MM" after the month that holds most of its days:
 * with start day 25, "2026-10" is 25 Sept – 24 Oct. Start days 2–15 keep the
 * start month, 16–28 take the following month, so every month name is used
 * exactly once. All dates are "YYYY-MM-DD" strings; the math is calendar-only
 * (UTC), never affected by the time zone.
 */

export type Period = { label: string; start: string; end: string };

const pad = (n: number) => String(n).padStart(2, '0');

function ymd(y: number, m: number, d: number): string {
	// m is 1-based and may overflow; Date.UTC normalises it.
	const dt = new Date(Date.UTC(y, m - 1, d));
	return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function parse(date: string): [number, number, number] {
	const [y, m, d] = date.split('-').map(Number);
	return [y, m, d];
}

export function daysInMonth(y: number, m: number): number {
	return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: string, days: number): string {
	const [y, m, d] = parse(date);
	return ymd(y, m, d + days);
}

export function addMonthsToLabel(label: string, n: number): string {
	const [y, m] = label.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1 + n, 1));
	return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
}

export function clampStartDay(day: number): number {
	return Math.min(28, Math.max(1, Math.trunc(day) || 1));
}

/** Months between the label and the month the period starts in (0 or -1). */
function startOffset(startDay: number): number {
	return startDay === 1 || startDay <= 15 ? 0 : -1;
}

export function periodRange(label: string, startDay: number): Period {
	startDay = clampStartDay(startDay);
	const [y, m] = label.split('-').map(Number);
	const sm = m + startOffset(startDay);
	const start = ymd(y, sm, startDay);
	const end = addDays(ymd(y, sm + 1, startDay), -1);
	return { label, start, end };
}

export function periodFor(date: string, startDay: number): Period {
	startDay = clampStartDay(startDay);
	const [y, m, d] = parse(date);
	// Month (1-based, may be 0) in which the containing period starts.
	const sm = d >= startDay ? m : m - 1;
	const labelMonth = sm - startOffset(startDay);
	const dt = new Date(Date.UTC(y, labelMonth - 1, 1));
	return periodRange(`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`, startDay);
}

export const prevPeriod = (label: string) => addMonthsToLabel(label, -1);
export const nextPeriod = (label: string) => addMonthsToLabel(label, 1);

/** The n labels ending with `label`, oldest first. */
export function periodsEndingAt(label: string, n: number): string[] {
	return Array.from({ length: n }, (_, i) => addMonthsToLabel(label, i - n + 1));
}

export function isPeriodLabel(s: string | null | undefined): s is string {
	return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function isIsoDate(s: string | null | undefined): s is string {
	if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const [y, m, d] = parse(s);
	return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function dateInRange(date: string, p: { start: string; end: string }): boolean {
	return date >= p.start && date <= p.end;
}

/** Today's date in the process/browser time zone (TZ=Europe/Paris on the server). */
export function todayISO(now = new Date()): string {
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const MONTHS = [
	'Janvier',
	'Février',
	'Mars',
	'Avril',
	'Mai',
	'Juin',
	'Juillet',
	'Août',
	'Septembre',
	'Octobre',
	'Novembre',
	'Décembre'
];
const MONTHS_SHORT = [
	'janv.',
	'févr.',
	'mars',
	'avr.',
	'mai',
	'juin',
	'juil.',
	'août',
	'sept.',
	'oct.',
	'nov.',
	'déc.'
];

/** "2026-10" → "Octobre 2026" */
export function periodLabelText(label: string): string {
	const [y, m] = label.split('-').map(Number);
	return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-10" → "oct. 26" (chart axes). */
export function periodShortText(label: string): string {
	const [y, m] = label.split('-').map(Number);
	return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

/** "25 sept. – 24 oct." (years shown when the range crosses one). */
export function periodRangeText(p: { start: string; end: string }): string {
	const [sy, sm, sd] = parse(p.start);
	const [ey, em, ed] = parse(p.end);
	const withYear = sy !== ey;
	const a = `${sd} ${MONTHS_SHORT[sm - 1]}${withYear ? ` ${sy}` : ''}`;
	const b = `${ed} ${MONTHS_SHORT[em - 1]}${withYear ? ` ${ey}` : ''}`;
	return `${a} – ${b}`;
}
