import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	test: {
		environment: 'jsdom',
		// A negative-offset zone is the one that turns `new Date('2026-10-13')` into 12 October, so
		// any helper that formats an API day through the local clock fails here, not on an
		// admin's laptop abroad (`admin/analytics/analytics.utils.ts`).
		env: { TZ: 'America/Los_Angeles' },
		setupFiles: ['./vitest.setup.ts'],
		// Playwright specs live in e2e/ and must not be picked up by vitest.
		exclude: [...configDefaults.exclude, 'e2e/**']
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	}
})
