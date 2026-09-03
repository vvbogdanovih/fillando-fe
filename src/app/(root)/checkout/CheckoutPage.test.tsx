import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCartStore } from '@/common/store/useCartStore'
import { CheckoutPage } from './CheckoutPage'
import { createOrder, fetchActivePaymentProvider, initLiqpayCheckout } from './checkout.api'
import { submitLiqpayForm } from './liqpay.utils'

// `vi.mock` factories are hoisted above imports, so anything they close over must be hoisted too.
const { routerPush, routerReplace, GUEST_ITEM } = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerReplace: vi.fn(),
	GUEST_ITEM: {
		variant_id: 'variant-1',
		quantity: 1,
		_meta: { name: 'PLA 1.75 чорний', price: 700, thumbnail: null, slug: 'pla-175-black' }
	}
}))

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))

vi.mock('next/navigation', () => ({
	useRouter: () => ({ replace: routerReplace, push: routerPush })
}))

vi.mock('react-hot-toast', () => ({
	default: { error: vi.fn(), success: vi.fn() }
}))

vi.mock('@/common/store/useAuthStore', () => ({
	useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: null })
}))

// A real in-memory zustand store rather than a static selector stub: `clearAfterOrder`
// must actually empty the cart and re-render the page, because the redirect race under
// test ("cart emptied → bounce to catalog") only exists when the store really changes.
vi.mock('@/common/store/useCartStore', async () => {
	const { create } = await import('zustand')
	const useCartStore = create<{
		items: never[]
		guestItems: (typeof GUEST_ITEM)[]
		isLoading: boolean
		clearAfterOrder: () => Promise<void>
		updateQuantity: () => Promise<void>
		setGuestItemQuantity: () => void
	}>(set => ({
		items: [],
		guestItems: [GUEST_ITEM],
		isLoading: false,
		clearAfterOrder: vi.fn(async () => set({ guestItems: [] })),
		updateQuantity: vi.fn(async () => {}),
		setGuestItemQuantity: vi.fn()
	}))
	// The real store is a persist store; CheckoutPage gates its empty-cart redirect on hydration.
	Object.assign(useCartStore, {
		persist: { hasHydrated: () => true, onFinishHydration: () => () => {} }
	})
	return { useCartStore }
})

vi.mock('./checkout.api', () => ({
	createOrder: vi.fn(),
	initLiqpayCheckout: vi.fn(),
	fetchActivePaymentProvider: vi.fn(async () => null),
	fetchNovaPostCities: vi.fn(async () => []),
	fetchNovaPostWarehouses: vi.fn(async () => []),
	validateCouponCode: vi.fn()
}))

vi.mock('./liqpay.utils', () => ({
	submitLiqpayForm: vi.fn()
}))

const LIQPAY_CHECKOUT = {
	data: 'signed-payload',
	signature: 'signature',
	action_url: 'https://www.liqpay.ua/api/3/checkout'
}

const renderCheckout = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CheckoutPage />
		</QueryClientProvider>
	)
}

const codRadio = () => screen.getByRole('radio', { name: /Накладний платіж/ })
const deliveryRadio = (name: RegExp) => screen.getByRole('radio', { name })
const submitButton = () => screen.getByRole('button', { name: /Замовити|Відправка/ })
const clearAfterOrderMock = () => vi.mocked(useCartStore.getState().clearAfterOrder)

/** Minimal valid form: contact details + self-pickup (no Nova Post city/warehouse pickers). */
const fillPickupOrder = () => {
	fireEvent.change(screen.getByLabelText('ПІБ'), { target: { value: 'Тест Тестенко' } })
	fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+380991234567' } })
	fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
	fireEvent.click(deliveryRadio(/Самовивіз/))
}

const submitOrder = async () => {
	await waitFor(() => expect(submitButton()).toBeEnabled())
	fireEvent.click(submitButton())
}

const selectLiqpay = async () => {
	fireEvent.click(await screen.findByRole('radio', { name: /Оплата карткою \(LiqPay\)/ }))
}

beforeEach(() => {
	// `resetAllMocks` also restores the implementations passed to `vi.fn(impl)` above,
	// so a per-test `mockResolvedValue` never leaks into the next test.
	vi.resetAllMocks()
	useCartStore.setState({ guestItems: [GUEST_ITEM] })
})

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

describe('CheckoutPage — накладний платіж', () => {
	it('asks for confirmation before selecting COD and keeps it after agreeing', async () => {
		renderCheckout()

		fireEvent.click(codRadio())

		expect(await screen.findByRole('dialog')).toHaveTextContent('щонайменше 200 ₴')

		fireEvent.click(screen.getByRole('button', { name: 'Погоджуюсь' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(codRadio()).toBeChecked()
	})

	it('restores the previous payment method when the conditions are declined', async () => {
		renderCheckout()

		const ibanRadio = screen.getByRole('radio', { name: /Оплата на рахунок/ })
		expect(ibanRadio).toBeChecked()

		fireEvent.click(codRadio())
		fireEvent.click(await screen.findByRole('button', { name: 'Скасувати' }))

		await waitFor(() => expect(codRadio()).not.toBeChecked())
		expect(ibanRadio).toBeChecked()
	})

	it('keeps COD selected when switching between the two Nova Post deliveries', async () => {
		renderCheckout()

		fireEvent.click(codRadio())
		fireEvent.click(await screen.findByRole('button', { name: 'Погоджуюсь' }))
		await waitFor(() => expect(codRadio()).toBeChecked())

		fireEvent.click(deliveryRadio(/Кур'єр Нова Пошта/))

		await waitFor(() => expect(deliveryRadio(/Кур'єр Нова Пошта/)).toBeChecked())
		expect(codRadio()).toBeChecked()
	})

	it('disables COD and falls back to IBAN on self-pickup', async () => {
		renderCheckout()

		fireEvent.click(codRadio())
		fireEvent.click(await screen.findByRole('button', { name: 'Погоджуюсь' }))
		await waitFor(() => expect(codRadio()).toBeChecked())

		fireEvent.click(deliveryRadio(/Самовивіз/))

		await waitFor(() => expect(codRadio()).toBeDisabled())
		expect(codRadio()).not.toBeChecked()
		expect(screen.getByRole('radio', { name: /Оплата на рахунок/ })).toBeChecked()
	})
})

describe('CheckoutPage — оформлення замовлення', () => {
	it('creates the order, clears the cart and goes to the success page without bouncing to the catalog', async () => {
		vi.mocked(createOrder).mockResolvedValue({ order_number: 'FO-0000123', total_price: 700 })

		renderCheckout()
		fillPickupOrder()
		await submitOrder()

		await waitFor(() => expect(routerPush).toHaveBeenCalledTimes(1))

		expect(createOrder).toHaveBeenCalledTimes(1)
		expect(createOrder).toHaveBeenCalledWith(
			expect.objectContaining({
				items: [{ variant_id: 'variant-1', quantity: 1 }],
				delivery_method: 'PICKUP',
				payment_method: 'IBAN',
				customer: {
					name: 'Тест Тестенко',
					phone: '+380991234567',
					email: 'test@example.com'
				}
			})
		)
		expect(clearAfterOrderMock()).toHaveBeenCalledTimes(1)

		const url = routerPush.mock.calls[0][0] as string
		expect(url.startsWith('/checkout/success?')).toBe(true)
		expect(url).toContain('order=FO-0000123')
		expect(url).toContain('payment=IBAN')

		// The cart is now empty, but that must not trigger the empty-cart redirect nor
		// swap the form for the loader while we are leaving the page.
		expect(useCartStore.getState().guestItems).toEqual([])
		expect(routerReplace).not.toHaveBeenCalled()
		expect(screen.queryByText('Завантаження…')).not.toBeInTheDocument()
		expect(submitButton()).toBeDisabled()
	})

	it('hands the browser over to LiqPay after the cart is cleared, without redirecting to the catalog', async () => {
		vi.mocked(fetchActivePaymentProvider).mockResolvedValue({ provider: 'LIQPAY' })
		vi.mocked(createOrder).mockResolvedValue({
			order_number: 'FO-0000123',
			payment_access_token: 'a'.repeat(32)
		})
		vi.mocked(initLiqpayCheckout).mockResolvedValue(LIQPAY_CHECKOUT)

		renderCheckout()
		fillPickupOrder()
		await selectLiqpay()
		await submitOrder()

		await waitFor(() =>
			expect(submitLiqpayForm).toHaveBeenCalledWith(
				LIQPAY_CHECKOUT.action_url,
				LIQPAY_CHECKOUT.data,
				LIQPAY_CHECKOUT.signature
			)
		)

		expect(initLiqpayCheckout).toHaveBeenCalledWith('FO-0000123')
		expect(clearAfterOrderMock()).toHaveBeenCalledTimes(1)
		expect(clearAfterOrderMock().mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(submitLiqpayForm).mock.invocationCallOrder[0]
		)
		expect(routerPush).not.toHaveBeenCalled()
		expect(routerReplace).not.toHaveBeenCalled()
		expect(screen.queryByText('Завантаження…')).not.toBeInTheDocument()
		expect(submitButton()).toBeDisabled()
		expect(submitButton()).toHaveTextContent('Відправка…')
	})

	it('falls back to the success page with the access token when LiqPay init fails', async () => {
		vi.mocked(fetchActivePaymentProvider).mockResolvedValue({ provider: 'LIQPAY' })
		vi.mocked(createOrder).mockResolvedValue({
			order_number: 'FO-0000123',
			payment_access_token: 'a'.repeat(32)
		})
		vi.mocked(initLiqpayCheckout).mockRejectedValue(new Error('LiqPay unavailable'))

		renderCheckout()
		fillPickupOrder()
		await selectLiqpay()
		await submitOrder()

		await waitFor(() => expect(routerPush).toHaveBeenCalledTimes(1))

		// The cart is cleared only once we know whether LiqPay could be opened.
		expect(clearAfterOrderMock()).toHaveBeenCalledTimes(1)
		expect(clearAfterOrderMock().mock.invocationCallOrder[0]).toBeGreaterThan(
			vi.mocked(initLiqpayCheckout).mock.invocationCallOrder[0]
		)

		const url = routerPush.mock.calls[0][0] as string
		expect(url.startsWith('/checkout/success?')).toBe(true)
		expect(url).toContain('order=FO-0000123')
		expect(url).toContain('payment=LIQPAY')
		expect(url).toContain(`token=${'a'.repeat(32)}`)

		expect(submitLiqpayForm).not.toHaveBeenCalled()
		expect(routerReplace).not.toHaveBeenCalled()
		expect(toast.error).toHaveBeenCalledWith(
			expect.stringContaining('не вдалося відкрити сторінку оплати')
		)
	})

	it('pins a server coupon error to the coupon field, translated', async () => {
		vi.mocked(createOrder).mockRejectedValue(new Error('Invalid coupon code'))

		renderCheckout()
		fillPickupOrder()
		await submitOrder()

		const fieldError = await screen.findByText('Купон не знайдено або він неактивний')
		expect(fieldError).toHaveAttribute('id', 'coupon_code-error')

		const couponInput = screen.getByLabelText('Coupon code')
		expect(couponInput).toHaveAttribute('aria-invalid', 'true')
		expect(couponInput).toHaveAttribute('aria-describedby', 'coupon_code-error')
		expect(couponInput).toHaveFocus()

		expect(toast.error).toHaveBeenCalledWith('Купон не знайдено або він неактивний')
		expect(clearAfterOrderMock()).not.toHaveBeenCalled()
		expect(routerPush).not.toHaveBeenCalled()
	})

	it('shows non-coupon server errors as a toast only, never on the coupon field', async () => {
		vi.mocked(createOrder).mockRejectedValue(new Error('Only 3 units available for SKU X'))

		renderCheckout()
		fillPickupOrder()
		await submitOrder()

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith('Only 3 units available for SKU X')
		)

		expect(document.getElementById('coupon_code-error')).toBeNull()
		expect(screen.queryByText('Only 3 units available for SKU X')).not.toBeInTheDocument()
		expect(screen.getByLabelText('Coupon code')).not.toHaveAttribute('aria-invalid', 'true')
		expect(clearAfterOrderMock()).not.toHaveBeenCalled()
		// The form is usable again for another attempt.
		expect(submitButton()).toBeEnabled()
	})

	it('explains rate limiting instead of echoing the raw 429 message', async () => {
		vi.mocked(createOrder).mockRejectedValue(
			Object.assign(new Error('ThrottlerException: Too Many Requests'), { status: 429 })
		)

		renderCheckout()
		fillPickupOrder()
		await submitOrder()

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith(
				'Занадто багато спроб. Зачекайте хвилину і спробуйте ще раз.'
			)
		)
		expect(document.getElementById('coupon_code-error')).toBeNull()
	})
})
