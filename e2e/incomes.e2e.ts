import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test('add an income and see the period total', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/revenus');
	await page.getByRole('button', { name: 'Nouveau revenu' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Montant').fill('2100');
	await sheet.getByLabel('Source').fill('Salaire');
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Revenu enregistré')).toBeVisible();
	await expect(page.getByTestId('income-row')).toContainText('Salaire');
	await expect(page.getByTestId('income-total')).toContainText('2 100,00');
});
