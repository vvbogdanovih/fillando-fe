import { expect, test } from '@playwright/test'
import {
	fillPickupContact,
	GUEST_ITEM,
	LIQPAY_SINK_URL,
	mockRequests,
	openCheckout,
	resetMockRequests,
	seedStorage,
	STOREFRONT_ORIGIN,
	submitButton
} from './helpers'

test('LiqPay order hands the browser over to LiqPay and empties the guest cart', async ({
	page,
	context,
	request
}) => {
	await resetMockRequests(request)
	await seedStorage(context, { cart: [GUEST_ITEM], consent: 'denied' })
	await openCheckout(page)

	await fillPickupContact(page)
	await page.getByRole('radio', { name: /Оплата карткою \(LiqPay\)/ }).check()
	await expect(submitButton(page)).toBeEnabled()
	await submitButton(page).click()

	// Landing on the sink proves the hidden-form POST was not cancelled by the empty-cart
	// redirect that clearing the cart would otherwise trigger (orderPlacedRef guard).
	await page.waitForURL(LIQPAY_SINK_URL)
	await expect(page.getByRole('heading', { name: 'LIQPAY SINK' })).toBeVisible()

	// create → init → form POST, in that order.
	const log = await mockRequests(request)
	const posts = log.filter(r => r.method === 'POST').map(r => r.path)
	expect(posts).toEqual(expect.arrayContaining(['/orders', '/liqpay/checkout', '/liqpay-sink']))
	expect(posts.indexOf('/orders')).toBeLessThan(posts.indexOf('/liqpay/checkout'))
	expect(posts.indexOf('/liqpay/checkout')).toBeLessThan(posts.indexOf('/liqpay-sink'))

	const order = log.find(r => r.method === 'POST' && r.path === '/orders')
	expect(order?.body).toMatchObject({
		payment_method: 'LIQPAY',
		delivery_method: 'PICKUP',
		items: [{ variant_id: GUEST_ITEM.variant_id, quantity: GUEST_ITEM.quantity }]
	})
	const sink = log.find(r => r.path === '/liqpay-sink')
	expect(sink?.body).toEqual({ data: 'ZmFrZQ==', signature: 'sig' })

	// The guest cart was cleared before leaving (storageState reads the storefront origin
	// even though the tab is now on the sink).
	const storage = await context.storageState()
	const origin = storage.origins.find(o => o.origin === STOREFRONT_ORIGIN)
	const cart = origin?.localStorage.find(entry => entry.name === 'fillando-cart')
	expect(cart).toBeDefined()
	expect(JSON.parse(cart!.value).state.guestItems).toEqual([])
})
