import { defineConfig, devices } from '@playwright/test'

/**
 * Release rehearsal (Plan-0010 R01 §5, owner decision 31.10.2026): the whole backend on a
 * disposable Mongo (fillando-be `test/release-e2e-server.ts` — `AppModule` with header auth and an
 * email recorder: an order sends nothing) and a production build of the storefront, because only
 * `next start` caches pages as production does and the purge test needs that cache. Requires the
 * sibling backend checkout and the test Mongo on 27018; never run it together with the backend
 * integration suite or `playwright.categories.config.ts` (the same Mongo).
 */
const API = 'http://127.0.0.1:19201'
const STOREFRONT = 'http://127.0.0.1:19200'
// Test values shared by both processes (the purge authenticates with the secret) — not `.env`'s.
const REVALIDATE_SECRET = 'e2e-release-revalidate-secret-0123456789'
const INTERNAL_API_TOKEN = 'e2e-release-internal-api-token-0123456789'

export default defineConfig({
	testDir: 'e2e/release',
	workers: 1,
	retries: 0,
	timeout: 180_000,
	expect: { timeout: 20_000 },
	reporter: [['list']],
	use: {
		baseURL: STOREFRONT,
		trace: 'retain-on-failure',
		actionTimeout: 20_000,
		navigationTimeout: 30_000
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command:
				'node -r ts-node/register/transpile-only -r tsconfig-paths/register test/release-e2e-server.ts',
			cwd: '../fillando-be',
			url: `${API}/categories/tree`,
			env: {
				DATABASE_URL: 'mongodb://127.0.0.1:27018/fillando-test-release-e2e',
				PORT: '19201',
				FRONTEND_URL: STOREFRONT,
				REVALIDATE_SECRET,
				INTERNAL_API_TOKEN,
				RUN_CRON: 'false',
				LOG_LEVEL: 'warn'
			},
			// ts-node compiles the whole module graph on start: about a minute, more on a busy machine.
			timeout: 300_000,
			gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
			reuseExistingServer: false
		},
		{
			// Built against the running API above: the build prerenders what it can, as in production.
			command: 'yarn next build && yarn next start -p 19200 --hostname 127.0.0.1',
			url: `${STOREFRONT}/contacts`,
			stdout: 'pipe',
			stderr: 'pipe',
			env: {
				NEXT_PUBLIC_API_BASE_URL: API,
				NEXT_PUBLIC_SITE_URL: STOREFRONT,
				NEXT_DIST_DIR: '.next-e2e/release',
				REVALIDATE_SECRET,
				INTERNAL_API_TOKEN
			},
			timeout: 600_000,
			gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
			reuseExistingServer: false
		}
	]
})
