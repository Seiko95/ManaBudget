import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { saveExpense } from '$lib/server/expenses';
import { readExpenseForm } from '$lib/server/expense-input';
import { processImages, storePhotos } from '$lib/server/photos';
import { alertsAfterSave } from '$lib/server/alerts';
import { requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const { input, buffers } = await readExpenseForm(request);
	const images = await processImages(buffers);
	const db = getDb();
	const watch = alertsAfterSave(db, user, input);
	const id = saveExpense(db, user.id, input);
	storePhotos(db, user.id, id, images);
	return json({ id, alerts: watch() }, { status: 201 });
};
