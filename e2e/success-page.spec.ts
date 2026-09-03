import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
	conversionEvents,
	LIQPAY_SINK_URL,
	lookupRequests,
	mockRequests,
	ORDER_NUMBER,
	resetMockRequests,
	seedStorage,
	TOKENS,
	waitForBoot,
	waitForLookups
} from './helpers'

const successUrl = (params: Record<string, string>) =>
	`/checkout/success?${new URLSearchParams(params).toString()}`

const liqpayUrl = (token?: string) =>
	successUrl({ order: ORDER_NUMBER, payment: 'LIQPAY', ...(token ? { token } : {}) })

/**
 * Negative assertion: there is nothing to wait *for*, so wait until everything that could
 * queue a conversion has happened — the app booted and the mock answered `lookups` order
 * lookups (each answer re-renders the card and re-runs the conversion effect) — and only
 * then read the dataLayer.
 */
async function expectNoConversion(page: Page, request: APIRequestContext, lookups: number) {
	await waitForBoot(request)
	await waitForLookups(request, lookups)
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
		page,
		request
	}) => {
		await page.goto(liqpayUrl(TOKENS.failed))

		await expect(page.getByText('Оплата не пройшла').first()).toBeVisible()
		const retry = page.getByRole('button', { name: 'Повторити оплату карткою' })
		await expect(retry).toBeVisible()
		await expect(page.getByRole('link', { name: 'Обрати інший спосіб оплати' })).toBeVisible()
		await expectNoConversion(page, request, 1)

		await retry.click()

		// startLiqpayCheckout → POST /liqpay/checkout → hidden form POST to action_url.
		await page.waitForURL(LIQPAY_SINK_URL)
		await expect(page.getByRole('heading', { name: 'LIQPAY SINK' })).toBeVisible()
	})

	test('LiqPay FAILED but paid meanwhile: retry is refused with a toast, lookup refetched, page stays', async ({
		page,
		request
	}) => {
		await page.goto(liqpayUrl(TOKENS.alreadyPaid))

		const retry = page.getByRole('button', { name: 'Повторити оплату карткою' })
		await expect(retry).toBeVisible()
		await waitForLookups(request, 1)

		await retry.click()

		// The backend's 400 message is toasted verbatim (retryMutation.onError) …
		await expect(
			page.getByRole('status').filter({ hasText: 'Order is already paid' })
		).toBeVisible()
		// … and the lookup is refetched so the card can catch up with the new status.
		await waitForLookups(request, 2)

		const log = await mockRequests(request)
		const init = log.filter(r => r.method === 'POST' && r.path === '/liqpay/checkout')
		expect(init).toHaveLength(1)
		expect(init[0].status).toBe(400)
		expect(init[0].body).toEqual({ order_number: ORDER_NUMBER })
		expect(lookupRequests(log).every(r => r.query.token === TOKENS.alreadyPaid)).toBe(true)

		// No hand-off to LiqPay happened; the mock keeps answering FAILED, so the card stays.
		await expect(page).toHaveURL(/\/checkout\/success/)
		await expect(retry).toBeVisible()
		await expectNoConversion(page, request, 2)
	})

	test('LiqPay PENDING: waiting card, re-polls the lookup, no conversion', async ({
		page,
		request
	}) => {
		await page.goto(liqpayUrl(TOKENS.pending))

		await expect(page.getByText('Очікуємо підтвердження оплати…').first()).toBeVisible()
		await expect(page.getByRole('button', { name: 'Повторити оплату карткою' })).toHaveCount(0)
		// A second lookup proves the 3 s poller is running; still PENDING → still no conversion.
		await expectNoConversion(page, request, 2)
		await expect(page.getByText('Очікуємо підтвердження оплати…').first()).toBeVisible()
	})

	test('LiqPay with an unknown token (lookup 404): neutral card, no conversion', async ({
		page,
		request
	}) => {
		await page.goto(liqpayUrl(TOKENS.unknown))

		// A 404 is definitive (wrong token / unknown order): no retries, the neutral card at once.
		await expect(
			page.getByRole('heading', { name: 'Замовлення прийнято' }).first()
		).toBeVisible()
		await expect(page.getByText(/Статус оплати ще не підтверджено/).first()).toBeVisible()
		await expectNoConversion(page, request, 1)
		expect(lookupRequests(await mockRequests(request))).toHaveLength(1)
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
		await expectNoConversion(page, request, 0)

		expect(lookupRequests(await mockRequests(request))).toEqual([])
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

		expect(lookupRequests(await mockRequests(request))).toEqual([])
	})
})
