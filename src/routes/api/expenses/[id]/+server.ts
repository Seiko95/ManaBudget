import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { deleteExpense, getExpense, saveExpense } from '$lib/server/expenses';
import { readExpenseForm } from '$lib/server/expense-input';
import { deletePhotoFiles, processImages, removePhotos, storePhotos } from '$lib/server/photos';
import { alertsAfterSave } from '$lib/server/alerts';
import { parseId, requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, params }) => {
	const user = requireUser(locals);
	return json({ expense: getExpense(getDb(), user.id, parseId(params.id)) });
};

export const PUT: RequestHandler = async ({ request, locals, params }) => {
	const user = requireUser(locals);
	const id = parseId(params.id);
	const db = getDb();
	getExpense(db, user.id, id); // 404 before reading uploads
	const { input, buffers, removePhotoIds } = await readExpenseForm(request);
	const images = await processImages(buffers);
	const watch = alertsAfterSave(db, user, input, id);
	saveExpense(db, user.id, input, id);
	removePhotos(db, user.id, id, removePhotoIds);
	storePhotos(db, user.id, id, images);
	return json({ id, alerts: watch() });
};

export const DELETE: RequestHandler = ({ locals, params }) => {
	const user = requireUser(locals);
	const files = deleteExpense(getDb(), user.id, parseId(params.id));
	deletePhotoFiles(user.id, files);
	return json({ ok: true });
};
