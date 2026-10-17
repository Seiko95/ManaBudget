import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test('a monthly rule starting in the past creates its due expenses', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/recurrents');
	await page.getByRole('button', { name: 'Nouvelle règle' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Montant', { exact: true }).fill('750');
	await sheet.getByLabel('Catégorie').selectOption({ label: 'Loyer' });
	await sheet.getByLabel('Description').fill('Loyer appartement');
	await sheet.getByLabel('Jour du mois').fill('1');
	// Start two months back: two or three occurrences are due depending on today
	const d = new Date();
	d.setMonth(d.getMonth() - 2, 1);
	const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
	await sheet.getByLabel('À partir du').fill(start);
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText(/Règle enregistrée · 3 élément/)).toBeVisible();
	await expect(page.getByTestId('rule-row').filter({ hasText: 'Loyer appartement' })).toBeVisible();
	await page.goto('/depenses?periode=tout&q=Loyer appartement');
	await expect(page.getByTestId('expense-row')).toHaveCount(3);
});
