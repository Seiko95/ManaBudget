import type { ServerInit } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';

export const init: ServerInit = () => {
	// Opening the database applies pending migrations.
	getDb();
};
