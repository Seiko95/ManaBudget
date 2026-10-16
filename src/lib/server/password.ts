import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended argon2id parameters.
const options = { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
	return hash(password, options);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
	try {
		return await verify(hashed, password);
	} catch {
		return false;
	}
}
