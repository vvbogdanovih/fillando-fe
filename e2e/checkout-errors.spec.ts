import { expect, test } from '@playwright/test'
import {
	checkoutForm,
	couponError,
	couponInput,
	fillPickupContact,
	GUEST_ITEM,
	openCheckout,
	resetMockRequests,
	seedStorage,
	submitButton,
	waitForBoot
} from './helpers'

test.describe('/checkout — server-side order errors', () => {
	test.beforeEach(async ({ context, page }) => {
		await seedStorage(context, { cart: [GUEST_ITEM], consent: 'denied' })
		await openCheckout(page)
	})

	test('stock error is shown as a toast and never pinned to the coupon field', async ({
		page
	}) => {
		await fillPickupContact(page)
		await expect(page.getByRole('radio', { name: /Оплата на рахунок \(IBAN\)/ })).toBeChecked()
		await page.getByPlaceholder('Наприклад: зателефонуйте перед відправкою…').fill('FAIL_STOCK')

		await expect(submitButton(page)).toBeEnabled()
		await submitButton(page).click()

		const message = 'Only 3 units available for SKU FIL-0001'
		await expect(page.getByRole('status').filter({ hasText: message })).toBeVisible()
		// Exactly one occurrence on the page — the toast — nothing under the coupon input.
		await expect(page.getByText(message)).toHaveCount(1)
		await expect(couponError(page)).toHaveCount(0)
		await expect(couponInput(page)).not.toHaveAttribute('aria-invalid', 'true')

		// Still on the checkout page with a usable form.
		await expect(page).toHaveURL(/\/checkout$/)
		await expect(submitButton(page)).toBeEnabled()
	})

	test('coupon rejected at order creation is pinned under the coupon input, translated', async ({
		page
	}) => {
		// Coupon first, on purpose: the live pre-validation (POST /discount-coupons/validate →
		// NOT_FOUND) marks the field through RHF `setError`, which also flips `isValid` to
		// false and disables «Замовити». Editing any other registered field re-runs the
		// resolver (which knows nothing about server errors) and re-enables the button.
		await couponInput(page).fill('BADCOUPON1')
		await expect(couponError(page)).toHaveText('Купон не знайдено')

		await fillPickupContact(page)
		await expect(submitButton(page)).toBeEnabled()
		await submitButton(page).click()

		await expect(couponError(page)).toHaveText('Купон не знайдено або він неактивний')
		await expect(couponInput(page)).toHaveAttribute('aria-invalid', 'true')
		await expect(couponInput(page)).toHaveAttribute('aria-describedby', 'coupon_code-error')
		await expect(couponInput(page)).toBeFocused()

		await expect(page).toHaveURL(/\/checkout$/)
	})
})

// Regression test for the `cartHydrated` / `cartReady` gate in CheckoutPage. On a HARD load
// the empty-cart effect used to run before Providers called `useCartStore.persist.rehydrate()`
// (React runs child effects first), saw `guestItems = []` and bounced the shopper to /filament
// with a full cart. The redirect now waits until the persisted cart is hydrated (and, for a
// logged-in user, until the first server cart response), so the seeded cart must stay put.
test('hard load of /checkout keeps the seeded guest cart on the page', async ({
	context,
	page,
	request
}) => {
	await resetMockRequests(request)
	await seedStorage(context, { cart: [GUEST_ITEM], consent: 'denied' })
	await page.goto('/checkout')

	// The form only renders once `cartReady` is true — the loader shows until then.
	await expect(page.getByRole('heading', { name: 'Оформлення замовлення' })).toBeVisible()
	await expect(checkoutForm(page).getByText(GUEST_ITEM._meta.name)).toBeVisible()

	// Boot has settled once checkAuth() finished its 401 → refresh → logout chain; a redirect,
	// had one been scheduled, would have fired by then.
	await waitForBoot(request)
	await expect(page).toHaveURL(/\/checkout$/)
	await expect(submitButton(page)).toBeVisible()
})
