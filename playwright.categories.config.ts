import { defineConfig, devices } from '@playwright/test'

/** Real category API + disposable Mongo, with local fixture authentication. Requires sibling backend checkout. */
export default defineConfig({
	testDir: 'e2e',
	testMatch: 'category-workspace.spec.ts',
	workers: 1,
	retries: 0,
	timeout: 120_000,
	expect: { timeout: 20_000 },
	use: { baseURL: 'http://127.0.0.1:19100', trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command:
				'node -r ts-node/register/transpile-only -r tsconfig-paths/register test/category-workspace-server.ts',
			cwd: '../fillando-be',
			url: 'http://127.0.0.1:19101/auth/me',
			timeout: 90_000,
			gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
			reuseExistingServer: false
		},
		{
			command: 'yarn next dev --webpack -p 19100 --hostname 127.0.0.1',
			url: 'http://127.0.0.1:19100/admin/categories',
			stdout: 'pipe',
			stderr: 'pipe',
			env: {
				NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:19101',
				NEXT_DIST_DIR: '.next-e2e/categories'
			},
			timeout: 180_000,
			gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
			reuseExistingServer: false
		}
	]
})
