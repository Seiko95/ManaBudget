import fs from 'node:fs';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getPhotoForUser } from '$lib/server/photos';
import { parseId, requireUser } from '$lib/server/scope';
import type { RequestHandler } from './$types';

/** Serves a photo only to its owner. */
export const GET: RequestHandler = ({ locals, params, url }) => {
	const user = requireUser(locals);
	const file = getPhotoForUser(getDb(), user.id, parseId(params.id), url.searchParams.has('thumb'));
	let data: Buffer;
	try {
		data = fs.readFileSync(file.path);
	} catch {
		error(404, 'Introuvable');
	}
	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': file.mime,
			'content-length': String(data.length),
			'cache-control': 'private, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
};
