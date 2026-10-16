import { expect, test } from '@playwright/test';
import { ADMIN, login, openNewExpense } from './helpers';

test.use({ geolocation: { latitude: 48.8567, longitude: 2.3523 }, permissions: ['geolocation'] });

test('statistics: charts render, drill down into a budget, place map', async ({ page }) => {
	await login(page, ADMIN);
	// An expense at a geolocated place, picked with the "nearest place" chip
	await openNewExpense(page);
	const sheet = page.getByRole('dialog', { name: 'Nouvelle dépense' });
	await sheet.getByLabel('Montant', { exact: true }).fill('4,20');
	await sheet.getByTestId('nearest-chip').click();
	await expect(sheet.getByRole('combobox', { name: 'Lieu' })).toHaveValue('Boulangerie du coin');
	await expect(sheet.getByTestId('selected-budget')).toContainText('Alimentation');
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(sheet).toBeHidden();

	await page.goto('/statistiques');
	await expect(page.getByTestId('chart-budgets').locator('canvas')).toBeVisible();
	await expect(page.getByTestId('chart-trend').locator('canvas')).toBeVisible();
	await page.getByTestId('chart-budgets').getByRole('button', { name: 'Alimentation' }).click();
	await expect(page.getByRole('heading', { name: 'Alimentation : par catégorie' })).toBeVisible();
	await page.getByTestId('chart-budgets').getByText('Voir le tableau').click();
	await expect(
		page.getByTestId('chart-budgets').getByRole('cell', { name: 'Courses' })
	).toBeVisible();
	await page.getByRole('link', { name: '12 mois' }).click();
	await expect(page).toHaveURL(/n=12/);
	await expect(
		page.getByTestId('chart-places').getByRole('region', { name: 'Carte des dépenses par lieu' })
	).toBeVisible();
});
