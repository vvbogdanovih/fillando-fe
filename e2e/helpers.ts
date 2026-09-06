import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

// Keep in sync with STOREFRONT_PORT / MOCK_API_PORT in playwright.config.ts.
export const STOREFRONT_ORIGIN = 'http://localhost:9100'
export const MOCK_API = 'http://localhost:9001'
export const LIQPAY_SINK_URL = `${MOCK_API}/liqpay-sink`
export const ORDER_NUMBER = 'FO-0000123'

/** 31 lowercase hex chars; the mock picks the payment status by the token's LAST char. */
const TOKEN_PREFIX = '0123456789abcdef0123456789abcde'
export const TOKENS = {
	paid: `${TOKEN_PREFIX}a`,
	failed: `${TOKEN_PREFIX}f`,
	/** Lookup says FAILED, but `POST /liqpay/checkout` answers 400 "Order is already paid". */
	alreadyPaid: `${TOKEN_PREFIX}p`,
	pending: `${TOKEN_PREFIX}e`,
	unknown: `${TOKEN_PREFIX}0`
} as const

/** Guest cart line in the shape `useCartStore` persists (`_meta` is what the UI renders). */
export const GUEST_ITEM = {
	variant_id: 'variant-1',
	quantity: 1,
	_meta: { name: 'PLA 1.75 чорний 1 кг', price: 700, thumbnail: null, slug: 'pla-175-black' }
}

type StorageSeed = {
	cart?: (typeof GUEST_ITEM)[]
	/** 'denied' hides the cookie banner without loading gtag.js — dataLayer stays a plain array. */
	consent?: 'granted' | 'denied'
}

/**
 * Pre-fills the zustand `persist` envelopes (`{ state, version }`) before the app boots.
 * Runs once per tab and origin (sessionStorage guard) so a later navigation does not
 * overwrite what the app itself wrote — e.g. the emptied cart after an order.
 */
export async function seedStorage(context: BrowserContext, seed: StorageSeed) {
	await context.addInitScript(
		({ cart, consent }) => {
			if (sessionStorage.getItem('e2e:seeded')) return
			sessionStorage.setItem('e2e:seeded', '1')
			localStorage.setItem(
				'fillando-consent',
				JSON.stringify({ state: { status: consent }, version: 0 })
			)
			if (cart) {
				localStorage.setItem(
					'fillando-cart',
					JSON.stringify({ state: { guestItems: cart }, version: 0 })
				)
			}
		},
		{ cart: seed.cart, consent: seed.consent ?? 'denied' }
	)
}

/** `gtag()` pushes `arguments` objects onto `window.dataLayer`; flatten them to arrays. */
export async function conversionEvents(page: Page): Promise<unknown[][]> {
	return page.evaluate(() => {
		const layer = (window as Window & { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []
		return Array.from(layer, entry => Array.from(entry)).filter(
			entry => entry[0] === 'event' && entry[1] === 'conversion'
		)
	})
}

export type MockRequest = {
	method: string
	path: string
	query: Record<string, string>
	body: unknown
	status: number
}

export async function mockRequests(request: APIRequestContext): Promise<MockRequest[]> {
	const res = await request.get(`${MOCK_API}/__e2e/requests`)
	return res.json()
}

export async function resetMockRequests(request: APIRequestContext) {
	await request.delete(`${MOCK_API}/__e2e/requests`)
}

export const lookupRequests = (log: MockRequest[]) =>
	log.filter(r => r.method === 'GET' && r.path.startsWith('/orders/lookup/'))

/**
 * The storefront has booted once `Providers` ran `checkAuth()`: GET /auth/me → 401 →
 * interceptor refresh → 401 → logout. Waiting for the tail of that chain replaces a fixed
 * sleep wherever a spec needs "the app is hydrated and its first effects have run".
 */
export async function waitForBoot(request: APIRequestContext) {
	await expect
		.poll(async () => (await mockRequests(request)).some(r => r.path === '/auth/logout'))
		.toBe(true)
}

/** Waits until the mock has answered at least `count` order lookups (the page polls on PENDING). */
export async function waitForLookups(request: APIRequestContext, count: number) {
	await expect
		.poll(async () => lookupRequests(await mockRequests(request)).length)
		.toBeGreaterThanOrEqual(count)
}

/**
 * Reaches /checkout the way a shopper does: land on a page, open the cart drawer, click
 * «Оформити замовлення». A hard load of /checkout works too — CheckoutPage waits for
 * `cartReady` (persist hydration; for a logged-in user also the first server cart response)
 * before it may redirect an empty cart — and `checkout-errors.spec.ts` keeps a regression
 * test for that. The drawer route stays the default because it is the real path.
 */
export async function openCheckout(page: Page) {
	await page.goto('/contacts')
	await page.getByRole('button', { name: 'Кошик' }).click()
	await page.getByRole('link', { name: 'Оформити замовлення' }).click()
	await expect(page).toHaveURL(/\/checkout$/)
	await expect(page.getByRole('heading', { name: 'Оформлення замовлення' })).toBeVisible()
	// The drawer lists the same item while it animates out — assert on the form's copy.
	await expect(page.getByRole('dialog')).toBeHidden()
	await expect(checkoutForm(page).getByText(GUEST_ITEM._meta.name)).toBeVisible()
}

/** The checkout page renders a single <form>; the cart drawer has none. */
export const checkoutForm = (page: Page) => page.locator('form')

/** Minimal valid order: contact details + self-pickup (no Nova Post pickers involved). */
export async function fillPickupContact(page: Page) {
	await page.getByLabel('ПІБ').fill('Тест Тестенко')
	await page.getByLabel('Телефон').fill('+380991234567')
	await page.getByLabel('Email', { exact: true }).fill('test@example.com')
	await page.getByRole('radio', { name: 'Самовивіз', exact: true }).check()
}

export const submitButton = (page: Page) =>
	page.getByRole('button', { name: 'Замовити', exact: true })

export const couponInput = (page: Page) => page.getByLabel('Знижковий купон')
export const couponError = (page: Page) => page.locator('#coupon_code-error')
