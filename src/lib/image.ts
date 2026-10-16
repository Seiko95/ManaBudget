/**
 * Shrinks a photo in the browser (≤ maxSize px on its longest side) before
 * upload, to save mobile data. Falls back to the original file when the
 * browser can't decode it (e.g. HEIC on some browsers).
 */
export async function shrinkImage(file: File, maxSize = 2000): Promise<Blob> {
	try {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
		if (scale === 1 && file.size < 1_500_000) {
			bitmap.close();
			return file;
		}
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
		return blob ?? file;
	} catch {
		return file;
	}
}
