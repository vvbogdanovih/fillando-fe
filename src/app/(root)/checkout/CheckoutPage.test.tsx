import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UI_URLS } from '@/common/constants'
import { useCartStore, type CartItem } from '@/common/store/useCartStore'
import { CheckoutPage } from './CheckoutPage'
import { createOrder, fetchActivePaymentProvider, initLiqpayCheckout } from './checkout.api'
import { submitLiqpayForm } from './liqpay.utils'

// `vi.mock` factories are hoisted above imports, so anything they close over must be hoisted too.
const { routerPush, routerReplace, GUEST_ITEM, authState, cartPersist } = vi.hoisted(() => {
	// Stand-in for the zustand `persist` API of the cart store. Tests flip `hydrated` and fire
	// the finish-hydration listeners the way `useCartStore.persist.rehydrate()` does in Providers.
	let hydrated = true
	const listeners = new Set<() => void>()
	return {
		routerPush: vi.fn(),
		routerReplace: vi.fn(),
		GUEST_ITEM: {
			variant_id: 'variant-1',
			quantity: 1,
			_meta: { name: 'PLA 1.75 чорний', price: 700, thumbnail: null, slug: 'pla-175-black' }
		},
		authState: { user: null as null | Record<string, unknown> },
		cartPersist: {
			hasHydrated: () => hydrated,
			onFinishHydration: (cb: () => void) => {
				listeners.add(cb)
				return () => {
					listeners.delete(cb)
				}
			},
			setHydrated: (value: boolean) => {
				hydrated = value
			},
			/** What `rehydrate()` does last: mark the store hydrated, then notify subscribers. */
			finishHydration: () => {
				hydrated = true
				listeners.forEach(cb => cb())
			},
			reset: () => {
				hydrated = true
				listeners.clear()
			}
		}
	}
})

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
	useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState)
}))

// A real in-memory zustand store rather than a static selector stub: `clearAfterOrder`
// must actually empty the cart and re-render the page, because the redirect race under
// test ("cart emptied → bounce to catalog") only exists when the store really changes.
vi.mock('@/common/store/useCartStore', async () => {
	const { create } = await import('zustand')
	const useCartStore = create<{
		items: CartItem[]
		guestItems: (typeof GUEST_ITEM)[]
		isLoading: boolean
		hasFetched: boolean
		clearAfterOrder: () => Promise<void>
		updateQuantity: () => Promise<void>
		setGuestItemQuantity: () => void
	}>(set => ({
		items: [],
		guestItems: [GUEST_ITEM],
		isLoading: false,
		hasFetched: false,
		clearAfterOrder: vi.fn(async () => set({ guestItems: [] })),
		updateQuantity: vi.fn(async () => {}),
		setGuestItemQuantity: vi.fn()
	}))
	// The real store is a persist store; CheckoutPage gates its empty-cart redirect on hydration
	// (and, for a logged-in user, on the first server cart response — `hasFetched`).
	Object.assign(useCartStore, {
		persist: {
			hasHydrated: cartPersist.hasHydrated,
			onFinishHydration: cartPersist.onFinishHydration
		}
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
	authState.user = null
	cartPersist.reset()
	useCartStore.setState({
		items: [],
		guestItems: [GUEST_ITEM],
		isLoading: false,
		hasFetched: false
	})
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

		const couponInput = screen.getByLabelText('Знижковий купон')
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
		expect(screen.getByLabelText('Знижковий купон')).not.toHaveAttribute('aria-invalid', 'true')
		expect(clearAfterOrderMock()).not.toHaveBeenCalled()
		// The form is usable again for another attempt.
		expect(submitButton()).toBeEnabled()
	})

	it('pins a stock shortfall under its own cart line, in Ukrainian, and marks it invalid', async () => {
		const serverMessage =
			'Доступно лише 3 шт. (FL-000001) — зменште кількість, щоб оформити замовлення'
		vi.mocked(createOrder).mockRejectedValue(
			Object.assign(new Error(serverMessage), {
				status: 409,
				details: { code: 'INSUFFICIENT_STOCK', variant_id: 'variant-1', available: 3 }
			})
		)

		renderCheckout()
		fillPickupOrder()
		await submitOrder()

		const lineError = await screen.findByRole('alert')
		expect(lineError).toHaveTextContent(/Доступно лише 3 шт\./)
		expect(lineError.closest('li')).toHaveAttribute('data-invalid')
		expect(toast.error).toHaveBeenCalledWith(serverMessage)
		expect(document.getElementById('coupon_code-error')).toBeNull()
		expect(clearAfterOrderMock()).not.toHaveBeenCalled()
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

describe('CheckoutPage — готовність кошика (cartReady)', () => {
	const USER = {
		id: 'u1',
		role: 'USER',
		email: 'user@example.com',
		name: 'Юзер Тестовий',
		picture: null,
		phone: null
	}
	const SERVER_ITEM: CartItem = {
		variant_id: 'variant-2',
		quantity: 2,
		added_at: '2026-09-01T00:00:00.000Z',
		variant: {
			name: 'PETG 1.75 білий',
			slug: 'petg-175-white',
			price: 650,
			stock: 10,
			thumbnail: null,
			v_value: null
		}
	}

	const loader = () => screen.queryByText('Завантаження…')
	const heading = () => screen.queryByRole('heading', { name: 'Оформлення замовлення' })

	it('guest: shows the loader and does not redirect before the persisted cart is hydrated', () => {
		cartPersist.setHydrated(false)
		useCartStore.setState({ guestItems: [] })

		renderCheckout()

		expect(loader()).toBeInTheDocument()
		expect(heading()).not.toBeInTheDocument()
		expect(routerReplace).not.toHaveBeenCalled()

		// Providers' rehydrate(): the persisted items land, then the finish-hydration listeners fire.
		act(() => {
			useCartStore.setState({ guestItems: [GUEST_ITEM] })
			cartPersist.finishHydration()
		})

		expect(heading()).toBeInTheDocument()
		expect(screen.getByText(GUEST_ITEM._meta.name)).toBeInTheDocument()
		expect(loader()).not.toBeInTheDocument()
		expect(routerReplace).not.toHaveBeenCalled()
	})

	it('guest: redirects to the catalogue only once hydration confirms the cart is empty', () => {
		cartPersist.setHydrated(false)
		useCartStore.setState({ guestItems: [] })

		renderCheckout()

		expect(loader()).toBeInTheDocument()
		expect(routerReplace).not.toHaveBeenCalled()

		act(() => {
			cartPersist.finishHydration()
		})

		expect(routerReplace).toHaveBeenCalledTimes(1)
		expect(routerReplace).toHaveBeenCalledWith(UI_URLS.CATALOG.FILAMENT)
		expect(loader()).toBeInTheDocument()
	})

	it('logged in: waits for the first server cart response before treating the cart as empty', () => {
		authState.user = USER
		useCartStore.setState({ items: [], isLoading: false, hasFetched: false })

		renderCheckout()

		// Hydrated, but `items` is [] only because fetchCart() has not answered yet.
		expect(loader()).toBeInTheDocument()
		expect(routerReplace).not.toHaveBeenCalled()

		act(() => {
			useCartStore.setState({ hasFetched: true })
		})

		expect(routerReplace).toHaveBeenCalledTimes(1)
		expect(routerReplace).toHaveBeenCalledWith(UI_URLS.CATALOG.FILAMENT)
	})

	it('logged in: renders the form once the server cart has been fetched with items', () => {
		authState.user = USER
		useCartStore.setState({ items: [SERVER_ITEM], hasFetched: true })

		renderCheckout()

		expect(heading()).toBeInTheDocument()
		expect(screen.getByText(SERVER_ITEM.variant.name)).toBeInTheDocument()
		expect(loader()).not.toBeInTheDocument()
		expect(routerReplace).not.toHaveBeenCalled()
	})
})
