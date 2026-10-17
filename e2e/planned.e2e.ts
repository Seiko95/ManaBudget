import { expect, test } from '@playwright/test';
import { ADMIN, login, openNewExpense, pickCombobox } from './helpers';

const pad = (n: number) => String(n).padStart(2, '0');

test('subscriptions and expenses added ahead show up as planned on the dashboard', async ({
	page
}) => {
	await login(page, ADMIN);
	const stamp = Date.now().toString(36);
	const now = new Date();
	const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const nextLabel = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
	const today = now.toLocaleDateString('sv-SE');

	// A monthly subscription
	await page.goto('/recurrents');
	await page.getByRole('button', { name: 'Nouvelle règle' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Montant', { exact: true }).fill('9,99');
	await sheet.getByLabel('Catégorie').selectOption({ label: 'Abonnements' });
	await sheet.getByLabel('Description').fill(`Musique ${stamp}`);
	await sheet.getByLabel('Jour du mois').fill('20');
	await sheet.getByLabel('À partir du').fill(`${nextLabel}-01`);
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByTestId('rule-row').filter({ hasText: `Musique ${stamp}` })).toBeVisible();

	// An expense added ahead, through the form: the date field explains it is planned
	await page.goto('/');
	await openNewExpense(page);
	const form = page.getByRole('dialog');
	await form.getByLabel('Montant', { exact: true }).fill('120');
	await form.getByLabel('Date', { exact: true }).fill(`${nextLabel}-10`);
	await expect(form.getByTestId('future-hint')).toBeVisible();
	await pickCombobox(page, form.getByRole('combobox', { name: 'Catégorie' }), 'Voyages');
	await form.getByLabel('Description').fill(`Billets ${stamp}`);
	await form.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Dépense enregistrée')).toBeVisible();

	// Next period on the dashboard: both are planned, nothing is spent yet
	await page.goto(`/?periode=${nextLabel}`);
	const upcoming = page.getByTestId('upcoming');
	await expect(
		upcoming.getByTestId('upcoming-row').filter({ hasText: `Billets ${stamp}` })
	).toContainText('120,00');
	await expect(
		upcoming.getByTestId('upcoming-row').filter({ hasText: `Musique ${stamp}` })
	).toContainText('9,99');
	await expect(page.getByTestId('tile-planned')).toContainText(/\d/);
	const loisirs = page.getByTestId('budget-progress').filter({ hasText: 'Loisirs' });
	await expect(loisirs).toContainText('prévu');

	// The expense list marks it as planned; the current period's real total is untouched
	await page.goto(`/depenses?periode=${nextLabel}&q=${encodeURIComponent(`Billets ${stamp}`)}`);
	await expect(page.getByTestId('expense-row')).toContainText('Prévue');
	await page.goto('/');
	await expect(
		page.getByTestId('upcoming-row').filter({ hasText: `Billets ${stamp}` })
	).toHaveCount(0);
	expect(today < `${nextLabel}-01`).toBe(true);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});
