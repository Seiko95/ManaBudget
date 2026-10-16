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
