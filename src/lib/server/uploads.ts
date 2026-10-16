import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

export function userUploadDir(userId: number): string {
	return path.join(config.uploadsDir, String(userId));
}

export function removeUserUploads(userId: number) {
	fs.rmSync(userUploadDir(userId), { recursive: true, force: true });
}
