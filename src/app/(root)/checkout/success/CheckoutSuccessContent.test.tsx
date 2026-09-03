import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const ORDER = 'FO-0000123'
const TOKEN = 'a'.repeat(32)

const lookupResult = (
	payment_status: OrderPaymentStatus['payment_status']
): OrderPaymentStatus => ({
	order_number: ORDER,
	payment_method: 'LIQPAY',
	payment_status,
	total_price: 1500
})

const renderSuccess = (query: string) => {
	navigation.search = new URLSearchParams(query)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CheckoutSuccessContent />
		</QueryClientProvider>
	)
}

describe('CheckoutSuccessContent — статус оплати', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
	afterEach(cleanup)

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

		renderSuccess(`order=${ORDER}&payment=LIQPAY&token=${TOKEN}`)

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

		renderSuccess(`order=${ORDER}&payment=LIQPAY&token=${TOKEN}`)

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

		submit.mockRestore()
	})

	it('LiqPay: PENDING keeps waiting and does not convert', async () => {
		vi.mocked(fetchOrderPaymentStatus).mockResolvedValue(lookupResult('PENDING'))

		renderSuccess(`order=${ORDER}&payment=LIQPAY&token=${TOKEN}`)

		expect(await screen.findByText('Очікуємо підтвердження оплати…')).toBeInTheDocument()
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
})
