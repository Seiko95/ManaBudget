/* Dev helper: screenshots of a running instance. Usage:
   SHOT_BASE=http://localhost:4180 SHOT_USER=admin SHOT_PASS=... SHOT_OUT=dir npx tsx e2e/tools/shots.ts / /admin */
import { chromium, devices } from '@playwright/test';

const base = process.env.SHOT_BASE ?? 'http://localhost:4180';
const out = process.env.SHOT_OUT ?? 'test-results/shots';
const paths = process.argv.slice(2);

const browser = await chromium.launch();
for (const [name, opts] of [
	['phone', { ...devices['Pixel 7'] }],
	['desktop', { viewport: { width: 1440, height: 900 } }],
	['phone-dark', { ...devices['Pixel 7'], colorScheme: 'dark' as const }]
] as const) {
	const ctx = await browser.newContext({ ...opts, locale: 'fr-FR' });
	const page = await ctx.newPage();
	await page.goto(base + '/login');
	await page.getByLabel("Nom d'utilisateur").fill(process.env.SHOT_USER ?? 'admin');
	await page.getByLabel('Mot de passe').fill(process.env.SHOT_PASS ?? 'motdepasse-admin');
	await page.getByRole('button', { name: 'Se connecter' }).click();
	await page.waitForURL((u) => !u.pathname.startsWith('/login'));
	for (const p of paths) {
		await page.goto(base + p);
		await page.waitForTimeout(800);
		const file = `${out}/${name}${p.replace(/[/?=&]/g, '_') || '_root'}.png`;
		await page.screenshot({ path: file, fullPage: true });
		console.log(file);
	}
	await ctx.close();
}
await browser.close();
