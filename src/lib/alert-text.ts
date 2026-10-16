import { formatPercent } from './format';
import { t } from './i18n/fr';

/** "Alimentation : 85 % du budget utilisé" (client copy of the server message). */
export function alertMessageClient(s: { name: string; pct: number; status: string }): string {
	const base = t.alerts.used
		.replace('{name}', s.name)
		.replace('{pct}', formatPercent(Math.floor(s.pct)));
	return s.status === 'over' ? `${base} ${t.alerts.overSuffix}` : base;
}
