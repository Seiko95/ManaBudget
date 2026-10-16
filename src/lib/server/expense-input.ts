import { error } from '@sveltejs/kit';
import type { ExpenseInput } from './expenses';
import { isIsoDate } from '../periods';
import { t } from '../i18n/fr';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_UPLOAD } from './photos';

const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** Parses the `data` JSON field of the expense form. */
export function parseExpenseInput(raw: unknown): ExpenseInput {
	const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const date = String(b.date ?? '');
	if (!isIsoDate(date)) error(400, t.common.invalidDate);
	const totalCents = int(b.totalCents);
	if (totalCents == null || totalCents <= 0) error(400, t.expenses.amountPositive);
	const splits = Array.isArray(b.splits) ? b.splits : [];
	return {
		date,
		totalCents,
		placeId: int(b.placeId),
		description: String(b.description ?? '').slice(0, 1000),
		splits: splits.map((s: Record<string, unknown>) => {
			const categoryId = int(s?.categoryId);
			const amountCents = int(s?.amountCents);
			if (categoryId == null) error(400, t.expenses.categoryRequired);
			if (amountCents == null) error(400, t.expenses.splitPositive);
			return { categoryId, amountCents };
		}),
		tags: (Array.isArray(b.tags) ? b.tags : []).map(String).slice(0, 20)
	};
}

/** Reads the multipart body: `data` (JSON), `photos` (files), `removePhotoIds` (JSON array). */
export async function readExpenseForm(request: Request) {
	const form = await request.formData();
	let data: unknown;
	try {
		data = JSON.parse(String(form.get('data') ?? '{}'));
	} catch {
		error(400, t.common.error);
	}
	const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
	if (files.length > MAX_PHOTOS_PER_UPLOAD) error(400, t.expenses.invalidPhoto);
	const buffers: Buffer[] = [];
	for (const f of files) {
		if (f.size > MAX_PHOTO_BYTES || !f.type.startsWith('image/'))
			error(400, t.expenses.invalidPhoto);
		buffers.push(Buffer.from(await f.arrayBuffer()));
	}
	let removePhotoIds: number[] = [];
	try {
		const r = JSON.parse(String(form.get('removePhotoIds') ?? '[]'));
		if (Array.isArray(r)) removePhotoIds = r.filter((x) => Number.isInteger(x));
	} catch {
		// ignore
	}
	return { input: parseExpenseInput(data), buffers, removePhotoIds };
}
