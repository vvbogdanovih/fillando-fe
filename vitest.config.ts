import { configDefaults, defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	test: {
		environment: 'jsdom',
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
