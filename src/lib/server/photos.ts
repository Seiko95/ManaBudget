import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { error } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from './db';
import { expenses, photos } from './db/schema';
import { notFoundUnless, owned, ownedById } from './scope';
import { userUploadDir } from './uploads';
import { t } from '../i18n/fr';

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS_PER_UPLOAD = 10;

/**
 * Resize to ≤2000 px, convert to WebP and make a 400 px thumbnail.
 * sharp drops all metadata (EXIF, including GPS) unless asked to keep it;
 * rotate() bakes the EXIF orientation into the pixels first.
 */
export async function processImage(input: Buffer) {
	const base = sharp(input, { failOn: 'error', limitInputPixels: 100_000_000 }).rotate();
	const { data: full, info } = await base
		.clone()
		.resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 80 })
		.toBuffer({ resolveWithObject: true });
	const thumb = await base
		.clone()
		.resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: 70 })
		.toBuffer();
	return { full, thumb, width: info.width, height: info.height };
}

export type ProcessedImage = Awaited<ReturnType<typeof processImage>>;

/** Processes every image first, so one bad file rejects the whole request before anything is written. */
export async function processImages(buffers: Buffer[]): Promise<ProcessedImage[]> {
	const out: ProcessedImage[] = [];
	for (const buf of buffers) {
		try {
			out.push(await processImage(buf));
		} catch {
			error(400, t.expenses.invalidPhoto);
		}
	}
	return out;
}

/** Stores already-processed images for an expense the user owns. */
export function storePhotos(db: DB, userId: number, expenseId: number, images: ProcessedImage[]) {
	notFoundUnless(
		db
			.select({ id: expenses.id })
			.from(expenses)
			.where(ownedById(expenses, userId, expenseId))
			.get()
	);
	const dir = userUploadDir(userId);
	fs.mkdirSync(dir, { recursive: true });
	return images.map((img) => {
		const id = randomUUID();
		const file = `${id}.webp`;
		const thumbFile = `${id}_thumb.webp`;
		fs.writeFileSync(path.join(dir, file), img.full);
		fs.writeFileSync(path.join(dir, thumbFile), img.thumb);
		return db
			.insert(photos)
			.values({
				userId,
				expenseId,
				file,
				thumbFile,
				mime: 'image/webp',
				width: img.width,
				height: img.height,
				size: img.full.length
			})
			.returning()
			.get();
	});
}

export async function addPhotos(db: DB, userId: number, expenseId: number, buffers: Buffer[]) {
	return storePhotos(db, userId, expenseId, await processImages(buffers));
}

export function deletePhotoFiles(userId: number, files: { file: string; thumbFile: string }[]) {
	const dir = userUploadDir(userId);
	for (const f of files) {
		fs.rmSync(path.join(dir, path.basename(f.file)), { force: true });
		fs.rmSync(path.join(dir, path.basename(f.thumbFile)), { force: true });
	}
}

/** Removes some of an expense's photos (rows and files). */
export function removePhotos(db: DB, userId: number, expenseId: number, photoIds: number[]) {
	if (!photoIds.length) return;
	const where = owned(
		photos,
		userId,
		and(eq(photos.expenseId, expenseId), inArray(photos.id, photoIds))
	);
	const rows = db
		.select({ file: photos.file, thumbFile: photos.thumbFile })
		.from(photos)
		.where(where)
		.all();
	if (rows.length !== new Set(photoIds).size) error(404, 'Introuvable');
	db.delete(photos).where(where).run();
	deletePhotoFiles(userId, rows);
}

/** Path of a photo file, after checking the user owns it. */
export function getPhotoForUser(db: DB, userId: number, photoId: number, thumb: boolean) {
	const row = notFoundUnless(
		db
			.select()
			.from(photos)
			.where(ownedById(photos, userId, photoId))
			.get()
	);
	const name = path.basename(thumb ? row.thumbFile : row.file);
	return { path: path.join(userUploadDir(userId), name), mime: row.mime };
}
