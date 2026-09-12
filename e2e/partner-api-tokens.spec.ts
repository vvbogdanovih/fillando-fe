import { test, expect } from '@playwright/test'
import { MOCK_API } from './helpers'

test('admin creates a token, dismisses its one-time secret and revokes access', async ({
	page
}) => {
	const token = {
		id: '000000000000000000000001',
		name: 'Партнер CRM',
		prefix: 'flnd_live_abcdef12',
		created_at: '2026-09-12T00:00:00Z',
		revoked_at: null as string | null,
		last_used_at: null
	}
	const secret = 'flnd_live_' + 'a'.repeat(64)
	let created = false
	await page.route(MOCK_API + '/cart', route =>
		route.fulfill({ json: { items: [], removed_items: [] } })
	)
	await page.route(MOCK_API + '/auth/me', route =>
		route.fulfill({
			json: {
				message: 'OK',
				user: {
					id: 'admin',
					role: 'ADMIN',
					name: 'Admin',
					email: 'admin@example.com',
					picture: null
				}
			}
		})
	)
	await page.route(MOCK_API + '/admin/api-tokens**', async route => {
		if (route.request().method() === 'POST') {
			expect(route.request().postDataJSON()).toEqual({ name: 'Партнер CRM' })
			created = true
			return route.fulfill({ status: 201, json: { ...token, token: secret } })
		}
		if (route.request().method() === 'DELETE') {
			token.revoked_at = '2026-09-12T01:00:00Z'
			return route.fulfill({ status: 204 })
		}
		return route.fulfill({ json: created ? [token] : [] })
	})
	await page.goto('/admin/api-tokens')
	await expect(page.getByText('API-токенів ще немає.')).toBeVisible()
	await expect(
		page.getByRole('link', { name: 'Публічна документація API (Swagger)' })
	).toHaveAttribute('href', MOCK_API + '/partner-docs')
	await page.getByLabel('Назва партнера або інтеграції').fill('Партнер CRM')
	await page.getByRole('button', { name: 'Створити токен' }).click()
	await expect(page.getByText(secret, { exact: true })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Створити токен' })).toBeDisabled()
	const storage = await page.evaluate(() => JSON.stringify(localStorage))
	expect(storage).not.toContain(secret)
	await page.getByRole('button', { name: 'Я зберіг токен — закрити' }).click()
	await expect(page.getByText(secret, { exact: true })).toHaveCount(0)
	await page.reload()
	await expect(page.getByText('Партнер CRM', { exact: true })).toBeVisible()
	await expect(page.getByText(secret, { exact: true })).toHaveCount(0)
	await page.getByRole('button', { name: 'Відкликати', exact: true }).click()
	await page.getByRole('button', { name: 'Скасувати' }).click()
	await expect(page.getByText('Інтеграція втратить доступ. Відкликати?')).toHaveCount(0)
	await page.getByRole('button', { name: 'Відкликати', exact: true }).click()
	await page.getByRole('button', { name: 'Так, відкликати' }).click()
	await expect(page.getByRole('cell', { name: /Відкликано/ })).toBeVisible()
})
