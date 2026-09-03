import { expect, test } from '@playwright/test'
import {
	couponError,
	couponInput,
	fillPickupContact,
	GUEST_ITEM,
	openCheckout,
	seedStorage,
	submitButton
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

// Known storefront issue, documented rather than worked around: a HARD load of /checkout with
// a guest cart bounces to /filament. CheckoutPage's empty-cart effect runs before Providers'
// `useCartStore.persist.rehydrate()` (React runs child effects first), so it sees
// `guestItems = []` on the first commit and calls `router.replace('/filament')`; the cart badge
// then shows the items on the catalog page. Flip to `test(...)` once the redirect is gated on
// store hydration.
test('hard load of /checkout keeps the seeded guest cart on the page', async ({
	context,
	page
}) => {
	await seedStorage(context, { cart: [GUEST_ITEM], consent: 'denied' })
	await page.goto('/checkout')
	await expect(page.getByText(GUEST_ITEM._meta.name)).toBeVisible()
	await page.waitForTimeout(3_000)
	await expect(page).toHaveURL(/\/checkout$/)
})
