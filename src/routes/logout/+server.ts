import { redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteSessionCookie, invalidateSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals, cookies }) => {
	if (locals.session) invalidateSession(getDb(), locals.session.id);
	deleteSessionCookie(cookies);
	redirect(303, '/login');
};

export const GET: RequestHandler = () => redirect(303, '/');
