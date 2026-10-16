import { config } from '$lib/server/config';
import { getDb } from '$lib/server/db';
import { alertCount } from '$lib/server/alerts';
import { currentPeriod } from '$lib/server/period';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.user;
	return {
		user,
		alertCount: user ? alertCount(getDb(), user.id, currentPeriod(user)) : 0,
		map: { tileUrl: config.tileUrl, geocodingEnabled: config.geocodingEnabled }
	};
};
