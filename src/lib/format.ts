import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const euroCompact = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	maximumFractionDigits: 0
});

/** 123456 → "1 234,56 €" */
export function formatCents(cents: number): string {
	return euro.format(cents / 100);
}

/** 123456 → "1 235 €" (for chart axes). */
export function formatCentsCompact(cents: number): string {
	return euroCompact.format(cents / 100);
}

/** "12,50" / "12.5" / "1 234,56 €" → cents. Null when not a valid amount. */
export function parseAmountToCents(input: string | null | undefined): number | null {
	if (input == null) return null;
	const s = String(input)
		.replace(/[\s\u00a0\u202f€]/g, '')
		.replace(',', '.');
	const m = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(s);
	if (!m) return null;
	const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
	return m[1] ? -cents : cents;
}

/** Cents → "12,50" for an editable input. */
export function centsToInput(cents: number | null | undefined): string {
	if (cents == null) return '';
	return (cents / 100).toFixed(2).replace('.', ',');
}

const num1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** Metres → "120 m" / "1,5 km". */
export function formatDistance(metres: number): string {
	if (metres < 1000) return `${Math.round(metres)} m`;
	return `${num1.format(metres / 1000)} km`;
}

const pct = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });

/** 85 → "85 %" */
export function formatPercent(value: number): string {
	return pct.format(value / 100);
}

/** "2026-10-16" → "vendredi 16 octobre 2026" */
export function formatDay(iso: string): string {
	return format(parseISO(iso), 'EEEE d MMMM yyyy', { locale: fr });
}

/** "2026-10-16" → "16 oct." */
export function formatShortDate(iso: string): string {
	return format(parseISO(iso), 'd MMM', { locale: fr });
}

/** "2026-10-16" → "16/10/2026" */
export function formatNumericDate(iso: string): string {
	return format(parseISO(iso), 'dd/MM/yyyy', { locale: fr });
}
