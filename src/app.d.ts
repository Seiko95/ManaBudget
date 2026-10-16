// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '$lib/server/auth';
import type { Session } from '$lib/server/db/schema';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			session: Session | null;
		}
	}
}

export {};
