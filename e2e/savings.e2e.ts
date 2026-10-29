import { expect, test, type Locator } from '@playwright/test';
import { ADMIN, login } from './helpers';

const pad = (n: number) => String(n).padStart(2, '0');

/** Reads a "1 234,56 €" tile as cents. */
async function cents(locator: Locator) {
	const text = (await locator.textContent()) ?? '';
	const n = text
		.replace(/[^\d,\-−]/g, '')
		.replace('−', '-')
		.replace(',', '.');
	return Math.round(Number(n) * 100);
}

test('money moved to savings leaves the balance, which carries into the next period', async ({
	page
}) => {
	await login(page, ADMIN);
	const now = new Date();
	const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const nextLabel = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;

	await page.goto('/');
	const balanceBefore = await cents(page.getByTestId('tile-balance'));
	const savingsBefore = await cents(page.getByTestId('tile-savings'));

	// Some income, then put part of it aside
	await page.goto('/revenus');
	await page.getByRole('button', { name: 'Nouveau revenu' }).click();
	let sheet = page.getByRole('dialog');
	await sheet.getByLabel('Montant').fill('1000');
	await sheet.getByLabel('Source').fill('Prime');
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Revenu enregistré')).toBeVisible();

	await page.goto('/epargne');
	await page.getByRole('button', { name: 'Transférer' }).click();
	sheet = page.getByRole('dialog');
	await sheet.getByLabel('Montant').fill('250');
	await sheet.getByLabel('Description').fill('Vacances');
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Transfert enregistré')).toBeVisible();
	await expect(page.getByTestId('savings-row').first()).toContainText('+250,00');

	// Withdrawing more than what is saved is refused
	await page.getByRole('button', { name: 'Transférer' }).click();
	sheet = page.getByRole('dialog');
	await sheet.getByText('Retirer de l’épargne').click();
	await sheet.getByLabel('Montant').fill(String(savingsBefore / 100 + 1000));
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText(/Vous ne pouvez pas retirer plus/)).toBeVisible();
	await page.keyboard.press('Escape');

	// Dashboard: savings went up, the balance only gained the part not put aside
	await page.goto('/');
	expect(await cents(page.getByTestId('tile-savings'))).toBe(savingsBefore + 25000);
	const balanceAfter = await cents(page.getByTestId('tile-balance'));
	expect(balanceAfter - balanceBefore).toBe(100000 - 25000);

	// Next period starts from what is left now (plus what is still planned before it)
	await page.goto(`/?periode=${nextLabel}`);
	await expect(page.getByTestId('balance-carried')).toBeVisible();
});
