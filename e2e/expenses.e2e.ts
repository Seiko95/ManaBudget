import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN, SECOND, isMobile, login, logout, openNewExpense, pickCombobox } from './helpers';

test.describe.configure({ mode: 'serial' });

test('add an expense: create a place from the list, split across 2 categories, tag and photo', async ({
	page
}) => {
	await login(page, ADMIN);
	await openNewExpense(page);
	const sheet = page.getByRole('dialog', { name: 'Nouvelle dépense' });
	await sheet.getByLabel('Montant', { exact: true }).fill('95,50');

	// Place: type a new name, choose the last item "+ Créer « … »"
	const placeInput = sheet.getByRole('combobox', { name: 'Lieu' });
	await placeInput.click();
	await placeInput.fill('Marché Bio');
	const create = page.getByRole('option', { name: 'Créer « Marché Bio »' });
	await expect(create).toBeVisible();
	await create.click();
	const placeSheet = page.getByRole('dialog', { name: 'Nouveau lieu' });
	await expect(placeSheet.getByLabel('Nom')).toHaveValue('Marché Bio');
	await placeSheet.getByLabel('Catégorie par défaut').selectOption({ label: 'Courses' });
	await placeSheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(placeSheet).toBeHidden();
	await expect(placeInput).toHaveValue('Marché Bio');
	// The place's default category fills the category picker
	await expect(sheet.getByTestId('selected-budget')).toContainText('Alimentation');

	// Split across two categories
	await sheet.getByLabel('Répartir le montant entre plusieurs catégories').click();
	const rows = sheet.getByTestId('split-rows');
	await rows.getByLabel('Montant 1').fill('85,50');
	await expect(sheet.getByTestId('split-remaining')).toContainText('10,00');
	await pickCombobox(page, rows.getByRole('combobox', { name: 'Catégorie 2' }), 'Sorties');
	await rows.getByLabel('Montant 2').fill('10');
	await expect(sheet.getByTestId('split-remaining')).toContainText('entièrement réparti');

	// Tag (new) and photo
	await sheet.getByLabel('Étiquettes').fill('marché');
	await sheet.getByLabel('Étiquettes').press('Enter');
	await expect(sheet.getByTestId('tag-chip')).toHaveText('marché');
	await sheet
		.getByTestId('photo-input')
		.setInputFiles(path.join(import.meta.dirname, 'fixtures/receipt.jpg'));
	await expect(sheet.getByTestId('new-photo')).toHaveCount(1);
	await sheet.getByLabel('Description').fill('Légumes et apéro');

	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Dépense enregistrée')).toBeVisible();
	// Alimentation has a 100 € limit (budgets test) with an 80 % alert: 85,50 € crosses it
	await expect(
		page
			.getByRole('region', { name: /Notifications/ })
			.getByText(/Alimentation : 85\s%\sdu budget utilisé/)
	).toBeVisible();
	await expect(sheet).toBeHidden();

	// It shows up in the list, with its detail, splits and photo
	await page.goto('/depenses');
	const row = page.getByTestId('expense-row').filter({ hasText: 'Marché Bio' });
	await expect(row).toContainText('95,50');
	await row.click();
	await expect(page.getByTestId('expense-total')).toContainText('95,50');
	await expect(page.getByTestId('split-line')).toHaveCount(2);
	await expect(page.getByText('marché', { exact: true })).toBeVisible();
	const thumb = page.getByRole('button', { name: 'Photo 1' });
	await expect(thumb).toBeVisible();
	await thumb.click();
	await expect(page.getByRole('img', { name: 'Photo 1' })).toBeVisible();
	await page.keyboard.press('Escape');
});

test('the dashboard progress bar and alert reflect the expense', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/');
	const bar = page.getByTestId('budget-progress').filter({ hasText: 'Alimentation' });
	await expect(bar).toHaveAttribute('data-status', 'warning');
	await expect(bar).toContainText('85 %');
	await expect(bar.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '86');
	await expect(page.getByTestId('alert-banner')).toContainText('Alimentation');
	await expect(page.getByTestId('tile-expenses')).toContainText('95,50');
	if (!isMobile(page)) await expect(page.getByTestId('alert-badge')).toHaveText('1');
});

test('filters in the URL return the expense', async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/depenses?q=légumes');
	await expect(page.getByTestId('expense-row')).toHaveCount(1);
	await page.goto('/depenses?min=90&max=100');
	await expect(page.getByTestId('expense-row')).toHaveCount(1);
	await page.goto('/depenses?min=100');
	await expect(page.getByTestId('expense-row')).toHaveCount(0);
	// Filter by category through the filter sheet
	await page.goto('/depenses');
	await page.getByRole('button', { name: /Filtres/ }).click();
	await page.getByLabel('Budget', { exact: true }).selectOption({ label: '🎉 Loisirs' });
	await page.getByLabel('Catégorie', { exact: true }).selectOption({ label: 'Sorties' });
	await page.getByRole('button', { name: 'Appliquer' }).click();
	await expect(page).toHaveURL(/budget=\d+/);
	await expect(page).toHaveURL(/categorie=\d+/);
	await expect(page.getByTestId('expense-row')).toHaveCount(1);
});

test("the second user sees none of the admin's data", async ({ page }) => {
	await login(page, ADMIN);
	await page.goto('/depenses');
	const href = await page.getByTestId('expense-row').first().getAttribute('href');
	const photoSrc = await (async () => {
		await page.goto(href!);
		return page.getByRole('button', { name: 'Photo 1' }).locator('img').getAttribute('src');
	})();
	await logout(page);
	await login(page, SECOND);
	await page.goto('/depenses?periode=tout');
	await expect(page.getByTestId('expense-row')).toHaveCount(0);
	expect((await page.goto(href!))?.status()).toBe(404);
	expect((await page.request.get(photoSrc!)).status()).toBe(404);
	expect((await page.request.get(`/api${href}`)).status()).toBe(404);
	await page.goto('/lieux');
	await expect(page.getByTestId('place-row')).toHaveCount(0);
});
