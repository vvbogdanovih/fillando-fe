import { expect, test, type Page } from '@playwright/test'
import {
	conversionEvents,
	LIQPAY_SINK_URL,
	mockRequests,
	ORDER_NUMBER,
	resetMockRequests,
	seedStorage,
	TOKENS
} from './helpers'

const successUrl = (params: Record<string, string>) =>
	`/checkout/success?${new URLSearchParams(params).toString()}`

const liqpayUrl = (token?: string) =>
	successUrl({ order: ORDER_NUMBER, payment: 'LIQPAY', ...(token ? { token } : {}) })

/** Negative assertion: let any late effect run before reading the dataLayer. */
async function expectNoConversion(page: Page) {
	await page.waitForTimeout(1_500)
	expect(await conversionEvents(page)).toEqual([])
}

// Same-route transitions in `next dev` briefly keep the previous page's card in the DOM, so
// heading locators use .first() — the assertions below still check text and state, not count.
test.describe('/checkout/success', () => {
	test.beforeEach(async ({ context, request }) => {
		await resetMockRequests(request)
		await seedStorage(context, { consent: 'denied' })
	})

	test('LiqPay PAID: thank-you card and exactly one purchase conversion', async ({ page }) => {
		await page.goto(liqpayUrl(TOKENS.paid))

		await expect(
			page.getByRole('heading', { name: 'Дякуємо за замовлення!' }).first()
		).toBeVisible()
		await expect(page.getByText(`#${ORDER_NUMBER}`).first()).toBeVisible()
		await expect(page.getByText('700 ₴').first()).toBeVisible()

		await expect.poll(() => conversionEvents(page)).toHaveLength(1)
		const [conversion] = await conversionEvents(page)
		expect(conversion[2]).toMatchObject({
			transaction_id: ORDER_NUMBER,
			value: 700,
			currency: 'UAH'
		})
		expect(conversion[2]).toHaveProperty('send_to')
	})

	test('LiqPay FAILED: failure card with card retry, no conversion; retry hands over to LiqPay', async ({
		page
	}) => {
		await page.goto(liqpayUrl(TOKENS.failed))

		await expect(page.getByText('Оплата не пройшла').first()).toBeVisible()
		const retry = page.getByRole('button', { name: 'Повторити оплату карткою' })
		await expect(retry).toBeVisible()
		await expect(page.getByRole('link', { name: 'Обрати інший спосіб оплати' })).toBeVisible()
		await expectNoConversion(page)

		await retry.click()

		// startLiqpayCheckout → POST /liqpay/checkout → hidden form POST to action_url.
		await page.waitForURL(LIQPAY_SINK_URL)
		await expect(page.getByRole('heading', { name: 'LIQPAY SINK' })).toBeVisible()
	})

	test('LiqPay PENDING: waiting card, no conversion', async ({ page }) => {
		await page.goto(liqpayUrl(TOKENS.pending))

		await expect(page.getByText('Очікуємо підтвердження оплати…').first()).toBeVisible()
		await expect(page.getByRole('button', { name: 'Повторити оплату карткою' })).toHaveCount(0)
		await expectNoConversion(page)
	})

	test('LiqPay with an unknown token (lookup 404): neutral card, no conversion', async ({
		page
	}) => {
		await page.goto(liqpayUrl(TOKENS.unknown))

		// React Query retries the lookup twice before surfacing the error.
		await expect(
			page.getByRole('heading', { name: 'Замовлення прийнято' }).first()
		).toBeVisible()
		await expect(page.getByText(/Статус оплати ще не підтверджено/).first()).toBeVisible()
		await expectNoConversion(page)
	})

	test('LiqPay without a token: neutral card, no lookup, no conversion', async ({
		page,
		request
	}) => {
		await page.goto(liqpayUrl())

		await expect(
			page.getByRole('heading', { name: 'Замовлення прийнято' }).first()
		).toBeVisible()
		await expect(page.getByText(`#${ORDER_NUMBER}`).first()).toBeVisible()
		await expectNoConversion(page)

		const lookups = (await mockRequests(request)).filter(r =>
			r.path.startsWith('/orders/lookup/')
		)
		expect(lookups).toEqual([])
	})

	test('offline method (COD): conversion fires on mount', async ({ page, request }) => {
		await page.goto(successUrl({ order: ORDER_NUMBER, payment: 'COD', total: '700' }))

		await expect(
			page.getByRole('heading', { name: 'Дякуємо за замовлення!' }).first()
		).toBeVisible()
		await expect(page.getByText(/накладним платежем/).first()).toBeVisible()

		await expect.poll(() => conversionEvents(page)).toHaveLength(1)
		const [conversion] = await conversionEvents(page)
		expect(conversion[2]).toMatchObject({
			transaction_id: ORDER_NUMBER,
			value: 700,
			currency: 'UAH'
		})

		const lookups = (await mockRequests(request)).filter(r =>
			r.path.startsWith('/orders/lookup/')
		)
		expect(lookups).toEqual([])
	})
})
