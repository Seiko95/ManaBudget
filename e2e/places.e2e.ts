import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.use({ geolocation: { latitude: 48.8566, longitude: 2.3522 }, permissions: ['geolocation'] });

test('create a place with my position and a default category, then see it sorted by distance', async ({
	page
}) => {
	await login(page, ADMIN);
	await page.goto('/lieux');
	await page.getByRole('button', { name: 'Nouveau lieu' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Nom').fill('Boulangerie du coin');
	await sheet.getByRole('button', { name: 'Utiliser ma position' }).click();
	await expect(sheet.getByText('Déplacez le repère')).toBeVisible();
	await sheet.getByLabel('Catégorie par défaut').selectOption({ label: 'Courses' });
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Lieu enregistré')).toBeVisible();
	const row = page.getByTestId('place-row').filter({ hasText: 'Boulangerie du coin' });
	await expect(row).toBeVisible();
	await expect(row).toContainText('0 m');
	await expect(row).toContainText('Courses');
});

test('nearby places group on the map, tooltips show this period’s spending, and a place can be deleted', async ({
	page
}) => {
	await login(page, ADMIN);
	const stamp = Date.now().toString(36);
	const nameA = `Primeur ${stamp}`;
	const nameB = `Fromager ${stamp}`;
	const form = await (await page.request.get('/api/expense-form')).json();
	const categoryId = form.budgets[0].categories[0].id;
	const today = new Date().toLocaleDateString('sv-SE');
	// Lyon, away from the other tests' places; ~60 m apart
	for (const [name, lat, cents] of [
		[nameA, 45.764, 1234],
		[nameB, 45.7645, 500]
	] as const) {
		const res = await page.request.post('/api/places', {
			data: { name, address: '', lat, lng: 4.8357, defaultCategoryId: null }
		});
		const { place } = await res.json();
		const saved = await page.request.post('/api/expenses', {
			headers: { origin: new URL(page.url()).origin },
			multipart: {
				data: JSON.stringify({
					date: today,
					totalCents: cents,
					placeId: place.id,
					description: `achat ${name}`,
					splits: [{ categoryId, amountCents: cents }],
					tags: []
				})
			}
		});
		expect(saved.status()).toBe(201);
	}

	await page.goto('/lieux');
	await expect(
		page.getByTestId('place-row').filter({ hasText: nameA }).getByText('12,34')
	).toBeVisible();

	// The two places share one group marker whose tooltip names them with their amounts
	const tooltip = page.locator('.leaflet-tooltip');
	const clusters = page.locator('.mb-cluster');
	await expect(clusters.first()).toBeVisible();
	let ours = -1;
	for (let i = 0; i < (await clusters.count()); i++) {
		await clusters.nth(i).hover();
		if ((await tooltip.last().textContent())?.includes(nameA)) {
			ours = i;
			break;
		}
	}
	expect(ours).toBeGreaterThanOrEqual(0);
	await expect(tooltip.last()).toContainText(nameB);
	await expect(tooltip.last()).toContainText('17,34');

	// Zooming in splits the group; a single dot's tooltip shows the period's spending
	await clusters.nth(ours).click();
	const dots = page.locator('.leaflet-overlay-pane path.leaflet-interactive[fill="#2a78d6"]');
	await expect(dots.first()).toBeVisible();
	let found = false;
	await expect(async () => {
		for (let i = 0; i < (await dots.count()) && !found; i++) {
			await dots.nth(i).hover({ force: true });
			const text = (await tooltip.last().textContent()) ?? '';
			found = text.includes(nameA) && text.includes('12,34');
		}
		expect(found).toBe(true);
	}).toPass({ timeout: 10_000 });

	// Nothing may widen the page past the screen (phone layout)
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);

	// Delete B for good: the row disappears, its expense stays
	const rowB = page.getByTestId('place-row').filter({ hasText: nameB });
	await rowB.getByRole('button', { name: 'Supprimer le lieu' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
	await expect(page.getByText('Lieu supprimé')).toBeVisible();
	await expect(rowB).toHaveCount(0);
	await page.goto(`/depenses?q=${encodeURIComponent(`achat ${nameB}`)}`);
	await expect(page.getByText(`achat ${nameB}`).first()).toBeVisible();
});
