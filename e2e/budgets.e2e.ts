import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test('set a monthly limit on a starter budget and add a category', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/budgets');
	const card = page.getByTestId('budget-card').filter({ hasText: 'Alimentation' });
	await expect(card).toContainText('Pas de limite');
	await card.getByRole('button', { name: 'Modifier le budget' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Limite mensuelle').fill('100');
	await sheet.getByLabel('Alerte à (%)').fill('80');
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(card).toContainText('Limite : 100,00 €');

	// The previous period keeps "no limit" (limit history)
	await page.getByRole('link', { name: 'Période précédente' }).click();
	await expect(page.getByTestId('budget-card').filter({ hasText: 'Alimentation' })).toContainText(
		'Pas de limite'
	);
	await page.getByRole('link', { name: 'Période suivante' }).click();

	await card.getByRole('button', { name: 'Nouvelle catégorie' }).click();
	await page.getByRole('dialog').getByLabel('Nom').fill('Boulangerie');
	await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
	await expect(card).toContainText('Boulangerie');
});

test('month start day setting changes the period preview', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/reglages');
	await page.getByLabel('Le mois commence le').selectOption('25');
	await expect(page.getByTestId('period-preview')).toContainText('25');
	await page.getByLabel('Le mois commence le').selectOption('1');
	await page.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Réglages enregistrés')).toBeVisible();
});

test('delete an unused category, then a used budget whose expenses move to another category', async ({
	page
}) => {
	await login(page, ADMIN);
	const stamp = Date.now().toString(36);
	const budgetName = `Temp ${stamp}`;
	await page.goto('/budgets');
	await page.getByRole('button', { name: 'Nouveau budget' }).click();
	await page.getByRole('dialog').getByLabel('Nom', { exact: true }).fill(budgetName);
	await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
	const card = page.getByTestId('budget-card').filter({ hasText: budgetName });
	for (const name of ['Utilisée', 'Inutile']) {
		await card.getByRole('button', { name: 'Nouvelle catégorie' }).click();
		await page.getByRole('dialog').getByLabel('Nom', { exact: true }).fill(name);
		await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
		await expect(card).toContainText(name);
	}

	// One expense filed under "Utilisée"
	const form = await (await page.request.get('/api/expense-form')).json();
	const used = form.budgets
		.find((b: { name: string }) => b.name === budgetName)
		.categories.find((c: { name: string }) => c.name === 'Utilisée');
	const description = `dépense ${stamp}`;
	const saved = await page.request.post('/api/expenses', {
		headers: { origin: new URL(page.url()).origin },
		multipart: {
			data: JSON.stringify({
				// An old period, so the dashboard totals other tests check stay put
				date: '2020-01-15',
				totalCents: 4200,
				placeId: null,
				description,
				splits: [{ categoryId: used.id, amountCents: 4200 }],
				tags: []
			})
		}
	});
	expect(saved.status()).toBe(201);
	await page.reload();

	// Unused category: deleted after a plain confirmation
	const unusedRow = card.getByRole('listitem').filter({ hasText: 'Inutile' });
	await unusedRow.getByRole('button', { name: 'Supprimer la catégorie' }).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('supprimée définitivement');
	await expect(dialog.getByLabel('Déplacer vers')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Supprimer' }).click();
	await expect(unusedRow).toHaveCount(0);

	// Used budget: asks where its expenses go
	await card.getByRole('button', { name: 'Supprimer le budget' }).click();
	await expect(dialog).toContainText('1 ligne(s) de dépense');
	await dialog.getByLabel('Déplacer vers').selectOption({ label: 'Divers' });
	await dialog.getByRole('button', { name: 'Supprimer' }).click();
	await expect(page.getByText('Supprimé', { exact: true }).last()).toBeVisible();
	await expect(card).toHaveCount(0);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);

	// The expense survived, now under Divers
	await page.goto(`/depenses?du=2020-01-01&au=2020-01-31&q=${encodeURIComponent(description)}`);
	await expect(page.getByText(description).first()).toBeVisible();
	await expect(page.getByText('Divers').first()).toBeVisible();
});
