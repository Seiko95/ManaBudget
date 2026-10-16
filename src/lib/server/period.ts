import { isPeriodLabel, periodFor, periodRange, todayISO, type Period } from '../periods';
import type { SessionUser } from './auth';

/** The period selected by `?periode=YYYY-MM`, or the current one. */
export function selectedPeriod(url: URL, user: SessionUser): Period & { isCurrent: boolean } {
	const current = periodFor(todayISO(), user.monthStartDay);
	const label = url.searchParams.get('periode');
	const p = isPeriodLabel(label) ? periodRange(label, user.monthStartDay) : current;
	return { ...p, isCurrent: p.label === current.label };
}

export function currentPeriod(user: Pick<SessionUser, 'monthStartDay'>): Period {
	return periodFor(todayISO(), user.monthStartDay);
}
