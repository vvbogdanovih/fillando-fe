import { defineConfig, devices } from '@playwright/test'

/**
 * Storefront e2e against a mock backend (`e2e/mock-api.mjs`) — no real API, no database.
 * The dev server is started on its own port (9100) with `NEXT_PUBLIC_API_BASE_URL` pointed
 * at the mock, so the suite neither depends on `.env` nor collides with a `yarn dev` on 9000.
 * Keep the two origins in sync with `e2e/helpers.ts`. See `e2e/README.md`.
 */
const STOREFRONT_PORT = 9100
const MOCK_API_PORT = 9001
const STOREFRONT_ORIGIN = `http://localhost:${STOREFRONT_PORT}`
const MOCK_API_ORIGIN = `http://localhost:${MOCK_API_PORT}`

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
		baseURL: STOREFRONT_ORIGIN,
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node e2e/mock-api.mjs',
			port: MOCK_API_PORT,
			env: { MOCK_API_PORT: String(MOCK_API_PORT), MOCK_API_ALLOW_ORIGIN: STOREFRONT_ORIGIN },
			reuseExistingServer: true,
			stdout: 'pipe',
			stderr: 'pipe'
		},
		{
			// `yarn dev` hard-codes `-p 9000` and `-p` beats PORT, so the port is passed explicitly.
			command: `yarn next dev -p ${STOREFRONT_PORT}`,
			port: STOREFRONT_PORT,
			// Variables already in process.env win over `.env`, so this is what the bundle gets.
			env: { NEXT_PUBLIC_API_BASE_URL: MOCK_API_ORIGIN, PORT: String(STOREFRONT_PORT) },
			reuseExistingServer: true,
			timeout: 180_000
		}
	]
})
