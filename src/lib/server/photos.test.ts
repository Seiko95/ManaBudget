import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addPhotos, getPhotoForUser, processImage, removePhotos } from './photos';
import { saveExpense } from './expenses';
import { listBudgets } from './budgets';
import { makeUser, testDb } from './test/db';

let tmp: string;
beforeAll(() => {
	tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-photos-'));
	process.env.DATA_DIR = tmp;
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function jpegWithGps(width: number, height: number) {
	return sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
		.jpeg()
		.withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 51/1 0/1' } })
		.toBuffer();
}

describe('processImage', () => {
	it('resizes to ≤2000 px, converts to WebP, strips EXIF and makes a 400 px thumbnail', async () => {
		const input = await jpegWithGps(3000, 1500);
		expect((await sharp(input).metadata()).exif).toBeDefined();
		const out = await processImage(input);
		const meta = await sharp(out.full).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.width).toBe(2000);
		expect(meta.height).toBe(1000);
		expect(meta.exif).toBeUndefined();
		const thumb = await sharp(out.thumb).metadata();
		expect(Math.max(thumb.width!, thumb.height!)).toBe(400);
		expect(thumb.exif).toBeUndefined();
		expect(out.width).toBe(2000);
	});

	it('rejects non-images', async () => {
		await expect(processImage(Buffer.from('not an image'))).rejects.toThrow();
	});
});

describe('photo storage & ownership', () => {
	it("stores files under the owner's folder and hides them from other users", async () => {
		const db = testDb();
		const a = await makeUser(db);
		const b = await makeUser(db);
		const cat = listBudgets(db, a.id, '2026-10-01')[0].categories[0];
		const expenseId = saveExpense(db, a.id, {
			date: '2026-10-10',
			totalCents: 100,
			placeId: null,
			description: '',
			splits: [{ categoryId: cat.id, amountCents: 100 }],
			tags: []
		});
		const [photo] = await addPhotos(db, a.id, expenseId, [await jpegWithGps(800, 600)]);
		const file = getPhotoForUser(db, a.id, photo.id, false);
		expect(file.path.startsWith(path.join(tmp, 'uploads', String(a.id)))).toBe(true);
		expect(fs.existsSync(file.path)).toBe(true);
		expect(() => getPhotoForUser(db, b.id, photo.id, false)).toThrow();
		expect(() => removePhotos(db, b.id, expenseId, [photo.id])).toThrow();
		removePhotos(db, a.id, expenseId, [photo.id]);
		expect(fs.existsSync(file.path)).toBe(false);
	});
});
