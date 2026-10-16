import { defineConfig, devices } from '@playwright/test';

/**
 * Two isolated servers (each with its own data dir) so the phone and desktop
 * runs both start from a fresh install. Set E2E_BASE_URL to run against an
 * already-running instance (e.g. the Docker container) instead.
 */
const external = process.env.E2E_BASE_URL;

const server = (port: number, dir: string) => ({
	command: `rm -rf ${dir} && node build`,
	port,
	reuseExistingServer: false,
	env: {
		PORT: String(port),
		ORIGIN: `http://localhost:${port}`,
		DATA_DIR: dir,
		GEOCODING_ENABLED: 'false',
		BODY_SIZE_LIMIT: '25M',
		TZ: 'Europe/Paris'
	}
});

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 60_000,
	reporter: [['list']],
	use: {
		locale: 'fr-FR',
		timezoneId: 'Europe/Paris',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: external
		? [
				{
					name: 'external',
					use: {
						...devices['Desktop Chrome'],
						baseURL: external,
						viewport: { width: 1440, height: 900 }
					}
				}
			]
		: [
				{
					name: 'pixel7',
					use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173' }
				},
				{
					name: 'desktop',
					use: {
						...devices['Desktop Chrome'],
						viewport: { width: 1440, height: 900 },
						baseURL: 'http://localhost:4174'
					}
				}
			],
	webServer: external
		? undefined
		: [server(4173, 'test-data/pixel7'), server(4174, 'test-data/desktop')]
});
