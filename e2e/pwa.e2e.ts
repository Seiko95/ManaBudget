import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test('installable PWA: manifest, icons, service worker', async ({ page, request }) => {
	await login(page, ADMIN);
	const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
	const res = await request.get(manifestHref!);
	expect(res.ok()).toBe(true);
	const manifest = await res.json();
	expect(manifest.display).toBe('standalone');
	expect(manifest.lang).toBe('fr');
	expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
	for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
	await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
	const swScope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
	expect(swScope).toMatch(/\/$/);
});
