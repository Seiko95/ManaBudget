import { parseAmountToCents } from '../format';
import { isHexColor } from '../colors';
import { isIsoDate } from '../periods';

/** Small typed readers for FormData fields. */
export function str(form: FormData, name: string, max = 500): string {
	return String(form.get(name) ?? '')
		.trim()
		.slice(0, max);
}

export function optInt(form: FormData, name: string): number | null {
	const v = String(form.get(name) ?? '').trim();
	if (!v) return null;
	const n = Number(v);
	return Number.isInteger(n) ? n : null;
}

export function int(form: FormData, name: string, fallback: number, min?: number, max?: number) {
	let n = optInt(form, name) ?? fallback;
	if (min !== undefined) n = Math.max(min, n);
	if (max !== undefined) n = Math.min(max, n);
	return n;
}

/** Amount in cents; null when empty or invalid. */
export function amount(form: FormData, name: string): number | null {
	return parseAmountToCents(String(form.get(name) ?? ''));
}

export function color(form: FormData, name: string, fallback: string): string {
	const c = str(form, name, 7);
	return isHexColor(c) ? c.toLowerCase() : fallback;
}

export function date(form: FormData, name: string): string | null {
	const d = str(form, name, 10);
	return isIsoDate(d) ? d : null;
}

export function bool(form: FormData, name: string): boolean {
	const v = form.get(name);
	return v === 'on' || v === 'true' || v === '1';
}
