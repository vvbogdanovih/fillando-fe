import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualDiscountCard } from './ManualDiscountCard'
import { ordersApi } from './orders.api'
import { orderSchema, type Order } from './orders.schema'

vi.mock('./orders.api', () => ({ ordersApi: { patchOrder: vi.fn() } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const patchOrder = vi.mocked(ordersApi.patchOrder)

const order = (over: Record<string, unknown> = {}): Order =>
	orderSchema.parse({
		_id: 'order-id',
		order_number: 'FO-0000123',
		items: [],
		subtotal_price: 1000,
		total_price: 1000,
		applied_discount: null,
		manual_discount: null,
		customer: { name: 'Тест', phone: '+380000000000', email: 'buyer@example.com' },
		delivery_method: 'NOVA_POST',
		payment_method: 'COD',
		payment_status: 'PENDING',
		order_status: 'NEW',
		...over
	})

const renderCard = (data: Order, onUpdated = vi.fn()) => {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ManualDiscountCard order={data} onUpdated={onUpdated} />
		</QueryClientProvider>
	)
	return onUpdated
}

describe('ManualDiscountCard', () => {
	beforeEach(() => patchOrder.mockReset())
	afterEach(cleanup)

	it('sends the amount and the trimmed reason', async () => {
		const updated = order({ total_price: 950 })
		patchOrder.mockResolvedValue(updated)
		const onUpdated = renderCard(order())

		fireEvent.change(screen.getByLabelText('Сума, ₴'), { target: { value: '50' } })
		fireEvent.change(screen.getByLabelText('Причина'), {
			target: { value: ' попросив по телефону ' }
		})
		fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))

		await waitFor(() =>
			expect(patchOrder).toHaveBeenCalledWith('order-id', {
				manual_discount: { amount: 50, reason: 'попросив по телефону' }
			})
		)
		await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated))
	})

	it('accepts a comma as the decimal separator', async () => {
		patchOrder.mockResolvedValue(order())
		renderCard(order())

		fireEvent.change(screen.getByLabelText('Сума, ₴'), { target: { value: '49,50' } })
		fireEvent.change(screen.getByLabelText('Причина'), { target: { value: 'x' } })
		fireEvent.click(screen.getByRole('button', { name: 'Застосувати' }))

		await waitFor(() =>
			expect(patchOrder).toHaveBeenCalledWith('order-id', {
				manual_discount: { amount: 49.5, reason: 'x' }
			})
		)
	})

	it.each(['0', '1000.01', 'abc', '10.555'])('keeps the button disabled for «%s»', value => {
		renderCard(order())

		fireEvent.change(screen.getByLabelText('Сума, ₴'), { target: { value } })
		fireEvent.change(screen.getByLabelText('Причина'), { target: { value: 'x' } })

		expect(screen.getByRole('button', { name: 'Застосувати' })).toBeDisabled()
	})

	it('needs a reason', () => {
		renderCard(order())

		fireEvent.change(screen.getByLabelText('Сума, ₴'), { target: { value: '50' } })
		fireEvent.change(screen.getByLabelText('Причина'), { target: { value: '   ' } })

		expect(screen.getByRole('button', { name: 'Застосувати' })).toBeDisabled()
	})

	it('shows the current discount and removes it with null', async () => {
		patchOrder.mockResolvedValue(order())
		renderCard(
			order({
				total_price: 950,
				manual_discount: { amount: 50, reason: 'постійний клієнт' }
			})
		)

		expect(screen.getByText(/постійний клієнт/)).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Прибрати' }))

		await waitFor(() =>
			expect(patchOrder).toHaveBeenCalledWith('order-id', { manual_discount: null })
		)
	})

	it('is read-only once the order is paid', () => {
		renderCard(order({ payment_status: 'PAID' }))

		expect(screen.getByText(/знижку можна оформити лише як повернення/)).toBeInTheDocument()
		expect(screen.queryByLabelText('Сума, ₴')).not.toBeInTheDocument()
	})
})

describe('orderSchema — discounts', () => {
	it('reads the coupon snapshot object instead of dropping it as NaN', () => {
		const parsed = order({
			applied_discount: { code: 'TEN', discount_percent: 10, discount_amount: 100 }
		})
		expect(parsed.applied_discount).toEqual({
			code: 'TEN',
			discount_percent: 10,
			discount_amount: 100
		})
	})

	it('treats an order written before the field existed as no manual discount', () => {
		expect(order({ manual_discount: undefined }).manual_discount).toBeUndefined()
	})
})
