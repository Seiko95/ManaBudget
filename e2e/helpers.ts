import { expect, type Page } from '@playwright/test';

export const ADMIN = { username: 'admin', password: 'motdepasse-admin', displayName: 'Camille' };
export const SECOND = { username: 'sacha', password: 'motdepasse-sacha', displayName: 'Sacha' };

export async function setupAdmin(page: Page) {
	await page.getByLabel('Nom affiché').fill(ADMIN.displayName);
	await page.getByLabel("Nom d'utilisateur").fill(ADMIN.username);
	await page.getByLabel('Mot de passe', { exact: true }).fill(ADMIN.password);
	await page.getByLabel('Confirmer le mot de passe').fill(ADMIN.password);
	await page.getByRole('button', { name: 'Créer le compte administrateur' }).click();
}

export async function login(page: Page, user: { username: string; password: string }) {
	await page.goto('/login');
	await page.getByLabel("Nom d'utilisateur").fill(user.username);
	await page.getByLabel('Mot de passe').fill(user.password);
	await page.getByRole('button', { name: 'Se connecter' }).click();
	await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
	await page.evaluate(async () => {
		await fetch('/logout', { method: 'POST' });
	});
	await page.goto('/login');
}

export async function createUserAsAdmin(
	page: Page,
	user: { username: string; password: string; displayName: string }
) {
	await page.goto('/admin');
	await page.getByRole('button', { name: 'Nouvel utilisateur' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Nom affiché').fill(user.displayName);
	await sheet.getByLabel("Nom d'utilisateur").fill(user.username);
	await sheet.getByLabel('Mot de passe').fill(user.password);
	await sheet.getByRole('button', { name: 'Créer' }).click();
	await expect(page.getByText('Utilisateur créé')).toBeVisible();
}

export function isMobile(page: Page) {
	return (page.viewportSize()?.width ?? 1440) < 1024;
}

export async function openNewExpense(page: Page) {
	if (isMobile(page)) await page.getByTestId('fab-new-expense').click();
	else await page.getByRole('button', { name: 'Nouvelle dépense' }).first().click();
	await expect(page.getByRole('dialog', { name: 'Nouvelle dépense' })).toBeVisible();
	await expect(page.getByLabel('Montant', { exact: true })).toBeVisible();
}

/** Picks an option in one of the app's comboboxes (place / category pickers). */
export async function pickCombobox(
	page: Page,
	input: ReturnType<Page['getByLabel']>,
	text: string,
	option?: string | RegExp
) {
	await input.click();
	await input.fill(text);
	await page
		.getByRole('option', { name: option ?? text })
		.first()
		.click();
}
