import { expect, test } from '@playwright/test';
import { ADMIN, SECOND, login, logout, setupAdmin, createUserAsAdmin } from './helpers';

test.describe.configure({ mode: 'serial' });

test('first run: setup creates the admin, who creates a second user', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
	await setupAdmin(page);
	await expect(page).toHaveURL(/\/$/);
	await createUserAsAdmin(page, SECOND);
	await expect(page.getByTestId('user-row')).toHaveCount(2);
	await logout(page);
	await expect(page).toHaveURL(/\/login/);
	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login/);
});

test('login rejects a wrong password and accepts the right one', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel("Nom d'utilisateur").fill(SECOND.username);
	await page.getByLabel('Mot de passe').fill('mauvais-mdp');
	await page.getByRole('button', { name: 'Se connecter' }).click();
	await expect(page.getByRole('alert')).toContainText('incorrect');
	await login(page, SECOND);
	await expect(page).toHaveURL(/\/$/);
	// Non-admins cannot reach the admin page
	const res = await page.goto('/admin');
	expect(res?.status()).toBe(403);
	await page.goto('/');
	await logout(page);
	await login(page, ADMIN);
});
