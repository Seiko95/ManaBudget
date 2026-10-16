import { expect, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

test.use({ geolocation: { latitude: 48.8566, longitude: 2.3522 }, permissions: ['geolocation'] });

test('create a place with my position and a default category, then see it sorted by distance', async ({
	page
}) => {
	await login(page, ADMIN);
	await page.goto('/lieux');
	await page.getByRole('button', { name: 'Nouveau lieu' }).click();
	const sheet = page.getByRole('dialog');
	await sheet.getByLabel('Nom').fill('Boulangerie du coin');
	await sheet.getByRole('button', { name: 'Utiliser ma position' }).click();
	await expect(sheet.getByText('Déplacez le repère')).toBeVisible();
	await sheet.getByLabel('Catégorie par défaut').selectOption({ label: 'Courses' });
	await sheet.getByRole('button', { name: 'Enregistrer' }).click();
	await expect(page.getByText('Lieu enregistré')).toBeVisible();
	const row = page.getByTestId('place-row').filter({ hasText: 'Boulangerie du coin' });
	await expect(row).toBeVisible();
	await expect(row).toContainText('0 m');
	await expect(row).toContainText('Courses');
});
