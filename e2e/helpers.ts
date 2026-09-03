import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

export const STOREFRONT_ORIGIN = 'http://localhost:9000'
export const MOCK_API = 'http://localhost:9001'
export const LIQPAY_SINK_URL = `${MOCK_API}/liqpay-sink`
export const ORDER_NUMBER = 'FO-0000123'

/** 31 lowercase hex chars; the mock picks the payment status by the token's LAST char. */
const TOKEN_PREFIX = '0123456789abcdef0123456789abcde'
export const TOKENS = {
	paid: `${TOKEN_PREFIX}a`,
	failed: `${TOKEN_PREFIX}f`,
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

/**
 * Reaches /checkout the way a shopper does: land on a page, open the cart drawer, click
 * «Оформити замовлення». A hard load of /checkout is NOT used on purpose — with a guest cart
 * it bounces to /filament, because CheckoutPage's empty-cart effect runs before Providers
 * rehydrates the persisted stores (child effects run first). See README + the fixme spec.
 */
export async function openCheckout(page: Page) {
	await page.goto('/contacts')
	await page.getByRole('button', { name: 'Кошик' }).click()
	await page.getByRole('link', { name: 'Оформити замовлення' }).click()
	await expect(page).toHaveURL(/\/checkout$/)
	await expect(page.getByRole('heading', { name: 'Оформлення замовлення' })).toBeVisible()
	await expect(page.getByText(GUEST_ITEM._meta.name)).toBeVisible()
}

/** Minimal valid order: contact details + self-pickup (no Nova Post pickers involved). */
export async function fillPickupContact(page: Page) {
	await page.getByLabel('ПІБ').fill('Тест Тестенко')
	await page.getByLabel('Телефон').fill('+380991234567')
	await page.getByLabel('Email', { exact: true }).fill('test@example.com')
	await page.getByRole('radio', { name: 'Самовивіз', exact: true }).check()
}

export const submitButton = (page: Page) =>
	page.getByRole('button', { name: 'Замовити', exact: true })

export const couponInput = (page: Page) => page.getByLabel('Coupon code')
export const couponError = (page: Page) => page.locator('#coupon_code-error')
