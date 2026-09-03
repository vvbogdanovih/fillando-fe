import {
	defaultScheduler,
	notifyManager,
	QueryClient,
	QueryClientProvider
} from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOrderPaymentStatus, initLiqpayCheckout } from '../checkout.api'
import type { OrderPaymentStatus } from '../checkout.api.schemas'
import { gtag } from '@/common/lib/gtag'
import { CheckoutSuccessContent } from './CheckoutSuccessContent'

const navigation = vi.hoisted(() => ({ search: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
	useSearchParams: () => navigation.search,
	useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}))

vi.mock('../checkout.api', () => ({
	fetchOrderPaymentStatus: vi.fn(),
	initLiqpayCheckout: vi.fn()
}))

vi.mock('@/common/lib/gtag', () => ({
	gtag: vi.fn()
}))

vi.mock('react-hot-toast', () => ({
	default: { error: vi.fn(), success: vi.fn() }
}))

const ORDER = 'FO-0000123'
const TOKEN = 'a'.repeat(32)
const LIQPAY_QUERY = `order=${ORDER}&payment=LIQPAY&token=${TOKEN}`

// Mirror LIQPAY_POLL_INTERVAL_MS / LIQPAY_POLL_WINDOW_MS in CheckoutSuccessContent.tsx.
const POLL_INTERVAL_MS = 3_000
const POLL_WINDOW_MS = 60_000

const NOT_CONFIRMED_TEXT =
	'Статус оплати ще не підтверджено. Щойно банк підтвердить платіж, ми надішлемо лист.'

const lookupResult = (
	payment_status: OrderPaymentStatus['payment_status']
): OrderPaymentStatus => ({
	order_number: ORDER,
	payment_method: 'LIQPAY',
	payment_status,
	total_price: 1500
})

/** `httpService` surfaces backend errors as `Error & { status }`. */
const apiError = (status: number, message: string) => Object.assign(new Error(message), { status })

const renderSuccess = (query: string) => {
	navigation.search = new URLSearchParams(query)
	// The lookup passes its own `retry` option, which wins over this default — the default
	// only keeps any other query from retrying under fake timers.
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CheckoutSuccessContent />
		</QueryClientProvider>
	)
}

/**
 * Moves the fake clock inside `act`: React Query schedules its retries, the poll interval
 * and even its "notify subscribers" step through (faked) timers, and the re-render they
 * trigger must be flushed before the DOM is asserted. `advance(0)` settles the initial fetch.
 */
const advance = (ms: number) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})

const retryButton = () => screen.queryByRole('button', { name: 'Повторити оплату карткою' })

describe('CheckoutSuccessContent — статус оплати', () => {
	beforeEach(() => {
		vi.resetAllMocks()
	})

	// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
	afterEach(() => {
		cleanup()
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	it('fires the purchase conversion on mount for an offline method (COD)', async () => {
		renderSuccess(`order=${ORDER}&payment=COD&total=1500`)

		expect(screen.getByText('Дякуємо за замовлення!')).toBeInTheDocument()
		expect(screen.getByText(`#${ORDER}`)).toBeInTheDocument()

		await waitFor(() => expect(gtag).toHaveBeenCalledTimes(1))
		expect(gtag).toHaveBeenCalledWith(
			'event',
			'conversion',
			expect.objectContaining({ transaction_id: ORDER, value: 1500, currency: 'UAH' })
		)
		expect(fetchOrderPaymentStatus).not.toHaveBeenCalled()
	})

	it('LiqPay: shows the thank-you card and converts once when the lookup says PAID', async () => {
		vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('PAID'))

		renderSuccess(LIQPAY_QUERY)

		expect(await screen.findByText('Дякуємо за замовлення!')).toBeInTheDocument()
		expect(fetchOrderPaymentStatus).toHaveBeenCalledWith(ORDER, TOKEN)
		expect(screen.getByText('1 500 ₴')).toBeInTheDocument()

		await waitFor(() => expect(gtag).toHaveBeenCalledTimes(1))
		expect(gtag).toHaveBeenCalledWith(
			'event',
			'conversion',
			expect.objectContaining({ transaction_id: ORDER, value: 1500, currency: 'UAH' })
		)
	})

	it('LiqPay: FAILED offers a card retry that restarts the LiqPay checkout, no conversion', async () => {
		vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('FAILED'))
		vi.mocked(initLiqpayCheckout).mockResolvedValue({
			action_url: 'https://www.liqpay.ua/api/3/checkout',
			data: 'payload',
			signature: 'sig'
		})
		// jsdom does not implement form submission; stub it so the redirect is observable.
		const submit = vi
			.spyOn(HTMLFormElement.prototype, 'submit')
			.mockImplementation(() => undefined)

		renderSuccess(LIQPAY_QUERY)

		expect(await screen.findByText('Оплата не пройшла')).toBeInTheDocument()
		expect(
			screen.getByText(
				'Банк відхилив платіж — кошти не списано. Замовлення збережено, товари зарезервовані.'
			)
		).toBeInTheDocument()

		fireEvent.click(screen.getByRole('button', { name: 'Повторити оплату карткою' }))

		await waitFor(() => expect(initLiqpayCheckout).toHaveBeenCalledWith(ORDER))
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
		expect(gtag).not.toHaveBeenCalled()
	})

	it('LiqPay: VOIDED renders the failure card with the card retry, no conversion', async () => {
		vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('VOIDED'))

		renderSuccess(LIQPAY_QUERY)

		expect(await screen.findByText('Оплата не пройшла')).toBeInTheDocument()
		expect(retryButton()).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Обрати інший спосіб оплати' })).toBeInTheDocument()
		expect(gtag).not.toHaveBeenCalled()
	})

	it('LiqPay: REFUNDED renders the neutral "refunded" card without a retry, no conversion', async () => {
		vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('REFUNDED'))

		renderSuccess(LIQPAY_QUERY)

		expect(await screen.findByText('Замовлення прийнято')).toBeInTheDocument()
		expect(
			screen.getByText(
				'Кошти за цим замовленням повернено. Деталі надіслані на вашу електронну пошту.'
			)
		).toBeInTheDocument()
		expect(retryButton()).not.toBeInTheDocument()
		expect(gtag).not.toHaveBeenCalled()
	})

	it('LiqPay: PENDING keeps waiting and does not convert', async () => {
		vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('PENDING'))

		renderSuccess(LIQPAY_QUERY)

		expect(await screen.findByText('Очікуємо підтвердження оплати…')).toBeInTheDocument()
		expect(retryButton()).not.toBeInTheDocument()
		expect(gtag).not.toHaveBeenCalled()
	})

	it('LiqPay without a token shows the neutral card and never converts', async () => {
		renderSuccess(`order=${ORDER}&payment=LIQPAY`)

		expect(await screen.findByText('Замовлення прийнято')).toBeInTheDocument()
		expect(
			screen.getByText(
				'Статус оплати ми перевіряємо. Лист із підтвердженням надійде на вашу пошту.'
			)
		).toBeInTheDocument()
		expect(fetchOrderPaymentStatus).not.toHaveBeenCalled()
		expect(gtag).not.toHaveBeenCalled()
	})

	describe('LiqPay polling (fake timers)', () => {
		beforeEach(() => {
			// Before the QueryClient is created, so every React Query timer lands on the fake clock.
			vi.useFakeTimers()
			// React Query tells subscribers about a result through setTimeout(…, 0). A zero-delay
			// timer created while the fake clock is mid-tick is placed 1 ms past the tick's target
			// and would need yet another advance; a microtask scheduler keeps `advance(ms)` exact.
			notifyManager.setScheduler(cb => queueMicrotask(cb))
		})

		afterEach(() => {
			notifyManager.setScheduler(defaultScheduler)
		})

		it('PENDING → PAID: re-polls after 3 s, converts exactly once and stops polling', async () => {
			vi.mocked(fetchOrderPaymentStatus)
				.mockResolvedValueOnce(lookupResult('PENDING'))
				.mockResolvedValue(lookupResult('PAID'))

			renderSuccess(LIQPAY_QUERY)
			await advance(0)

			expect(screen.getByText('Очікуємо підтвердження оплати…')).toBeInTheDocument()
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(1)
			expect(gtag).not.toHaveBeenCalled()

			await advance(POLL_INTERVAL_MS)

			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(2)
			expect(screen.getByText('Дякуємо за замовлення!')).toBeInTheDocument()
			expect(screen.getByText('1 500 ₴')).toBeInTheDocument()
			expect(gtag).toHaveBeenCalledTimes(1)
			expect(gtag).toHaveBeenCalledWith(
				'event',
				'conversion',
				expect.objectContaining({ transaction_id: ORDER, value: 1500, currency: 'UAH' })
			)

			// PAID is terminal: the poller is off and the conversion latch holds.
			await advance(POLL_INTERVAL_MS)
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(2)
			expect(gtag).toHaveBeenCalledTimes(1)
		})

		it('PENDING for the whole window: polls every 3 s, stops at 60 s and settles on the neutral card', async () => {
			vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('PENDING'))

			renderSuccess(LIQPAY_QUERY)
			await advance(0)
			expect(screen.getByText('Очікуємо підтвердження оплати…')).toBeInTheDocument()
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(1)

			// Tick by tick, like the browser: each poll re-arms the interval for the next one.
			const ticks = POLL_WINDOW_MS / POLL_INTERVAL_MS
			for (let i = 0; i < ticks; i++) {
				await advance(POLL_INTERVAL_MS)
			}
			// One lookup on mount + one per tick; the last tick coincides with the window closing.
			const callsAtExpiry = 1 + ticks
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(callsAtExpiry)

			expect(screen.getByText('Замовлення прийнято')).toBeInTheDocument()
			expect(screen.getByText(NOT_CONFIRMED_TEXT)).toBeInTheDocument()
			expect(retryButton()).not.toBeInTheDocument()

			// Window closed: the public lookup is not hit any more, and nothing converts.
			await advance(POLL_INTERVAL_MS * 5)
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(callsAtExpiry)
			expect(gtag).not.toHaveBeenCalled()
		})

		it('lookup 404 (wrong token / unknown order): neutral card after a single call, no retries, no conversion', async () => {
			vi.mocked(fetchOrderPaymentStatus).mockRejectedValue(apiError(404, 'Order not found'))

			renderSuccess(LIQPAY_QUERY)
			await advance(0)

			expect(screen.getByText('Замовлення прийнято')).toBeInTheDocument()
			expect(screen.getByText(NOT_CONFIRMED_TEXT)).toBeInTheDocument()
			expect(retryButton()).not.toBeInTheDocument()

			// Well past React Query's retry back-off (1 s, 2 s): the 404 was taken as definitive.
			await advance(10_000)
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(1)
			expect(gtag).not.toHaveBeenCalled()
		})

		it('transient lookup failure (500) is retried twice before the neutral card', async () => {
			vi.mocked(fetchOrderPaymentStatus).mockRejectedValue(apiError(500, 'Upstream down'))

			renderSuccess(LIQPAY_QUERY)
			await advance(0)
			expect(screen.getByText('Перевіряємо статус оплати…')).toBeInTheDocument()
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(1)

			await advance(1_000)
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(2)
			await advance(2_000)
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(3)

			expect(screen.getByText('Замовлення прийнято')).toBeInTheDocument()
			expect(screen.getByText(NOT_CONFIRMED_TEXT)).toBeInTheDocument()

			await advance(30_000)
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(3)
			expect(gtag).not.toHaveBeenCalled()
		})

		it('retry button: a failed init is toasted and the lookup is refetched so the card catches up', async () => {
			vi.mocked(fetchOrderPaymentStatus)
				.mockResolvedValueOnce(lookupResult('FAILED'))
				.mockResolvedValue(lookupResult('PAID'))
			vi.mocked(initLiqpayCheckout).mockRejectedValue(apiError(400, 'Order is already paid'))
			const submit = vi
				.spyOn(HTMLFormElement.prototype, 'submit')
				.mockImplementation(() => undefined)

			renderSuccess(LIQPAY_QUERY)
			await advance(0)
			expect(screen.getByText('Оплата не пройшла')).toBeInTheDocument()
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(1)

			fireEvent.click(screen.getByRole('button', { name: 'Повторити оплату карткою' }))
			await advance(0)

			expect(initLiqpayCheckout).toHaveBeenCalledWith(ORDER)
			expect(submit).not.toHaveBeenCalled()
			expect(toast.error).toHaveBeenCalledTimes(1)
			expect(toast.error).toHaveBeenCalledWith('Order is already paid')

			// onError refetched the lookup; it now reports PAID, so the card flips and converts.
			expect(fetchOrderPaymentStatus).toHaveBeenCalledTimes(2)
			expect(screen.getByText('Дякуємо за замовлення!')).toBeInTheDocument()
			expect(retryButton()).not.toBeInTheDocument()
			expect(gtag).toHaveBeenCalledTimes(1)
		})
	})
})
