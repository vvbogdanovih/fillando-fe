import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { myOrdersApi } from './orders.api'
import type { MyOrder } from './orders.schema'
import { OrderDetails } from './OrderDetails'

vi.mock('./orders.api', () => ({ myOrdersApi: { getMyOrderById: vi.fn() } }))
vi.mock('@/common/hooks/useLenisModalLock', () => ({ useLenisModalLock: () => undefined }))
vi.mock('next/image', () => ({ default: () => null }))

afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})

const order = (over: Partial<MyOrder> = {}): MyOrder => ({
	id: 'o1',
	order_number: 'FO-0000123',
	created_at: '2026-09-06T10:00:00.000Z',
	items: [],
	subtotal_price: 1000,
	total_price: 1000,
	applied_discount: null,
	customer: { name: 'Тест', phone: '+380000000000', email: 'buyer@example.com' },
	delivery_method: 'NOVA_POST',
	delivery_address: null,
	payment_method: 'LIQPAY',
	payment_status: 'PENDING',
	order_status: 'NEW',
	comment: null,
	...over
})

const renderDetails = (data: MyOrder) => {
	vi.mocked(myOrdersApi.getMyOrderById).mockResolvedValue(data)
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<OrderDetails orderId='o1' />
		</QueryClientProvider>
	)
}

describe('OrderDetails — payment actions (TD-0009)', () => {
	it('lets the buyer pay a pending LiqPay order by card or switch the method', async () => {
		renderDetails(order())

		expect(await screen.findByText('Замовлення #FO-0000123')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Оплатити карткою' })).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Обрати інший спосіб оплати' })
		).toBeInTheDocument()
	})

	it('offers only the method change for an unpaid offline order', async () => {
		renderDetails(order({ payment_method: 'IBAN' }))

		expect(await screen.findByText('Замовлення #FO-0000123')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Оплатити карткою/ })).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Обрати інший спосіб оплати' })
		).toBeInTheDocument()
	})

	it('explains a refused payment the way the success page does, and calls a retry a retry', async () => {
		renderDetails(order({ payment_status: 'FAILED' }))

		expect(await screen.findByText('Замовлення #FO-0000123')).toBeInTheDocument()
		expect(
			screen.getByText(
				'Банк відхилив платіж — кошти не списано. Замовлення збережено: можна оплатити карткою ще раз або обрати інший спосіб оплати.'
			)
		).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Повторити оплату карткою' })).toBeInTheDocument()
	})

	it('explains an unpaid IBAN order instead of only naming its status', async () => {
		renderDetails(order({ payment_method: 'IBAN' }))

		expect(await screen.findByText('Замовлення #FO-0000123')).toBeInTheDocument()
		expect(
			screen.getByText('Реквізити для оплати будуть надіслані на вашу електронну пошту.')
		).toBeInTheDocument()
	})

	it('passes the cooldown clock through, so the card button is not a click that answers 409', async () => {
		// The field rides along on the order response (`myOrderSchema` passes it through).
		renderDetails(order({ liqpay_retry_after_seconds: 600 } as Partial<MyOrder>))

		expect(await screen.findByText('Замовлення #FO-0000123')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Оплатити карткою можна через 10 хв' })
		).toBeDisabled()
	})

	it.each([
		['paid', { payment_status: 'PAID' as const }],
		['already in processing', { order_status: 'PROCESSING' as const }],
		['cancelled', { payment_status: 'VOIDED' as const, order_status: 'CANCELLED' as const }]
	])('shows no payment actions for an order that is %s', async (_label, over) => {
		renderDetails(order(over))

		expect(await screen.findByText('Замовлення #FO-0000123')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Оплатити карткою/ })).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Обрати інший спосіб оплати' })
		).not.toBeInTheDocument()
	})
})
