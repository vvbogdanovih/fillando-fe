import { defineConfig, devices } from '@playwright/test'

/**
 * Storefront e2e against a mock backend (`e2e/mock-api.mjs`, port 9001) — no real API, no
 * database. `NEXT_PUBLIC_API_BASE_URL` in `.env` must point at `http://localhost:9001` for
 * the dev server to talk to the mock. See `e2e/README.md`.
 */
export default defineConfig({
	testDir: 'e2e',
	fullyParallel: false,
	workers: 1,
	retries: 1,
	// `next dev` compiles a route on first request; the first test of a run pays for that.
	timeout: 90_000,
	expect: { timeout: 15_000 },
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://localhost:9000',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node e2e/mock-api.mjs',
			port: 9001,
			reuseExistingServer: true,
			stdout: 'pipe',
			stderr: 'pipe'
		},
		{
			command: 'yarn dev',
			port: 9000,
			reuseExistingServer: true,
			timeout: 180_000
		}
	]
})
