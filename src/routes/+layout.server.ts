import { config } from '$lib/server/config';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		user: locals.user,
		map: { tileUrl: config.tileUrl, geocodingEnabled: config.geocodingEnabled }
	};
};
