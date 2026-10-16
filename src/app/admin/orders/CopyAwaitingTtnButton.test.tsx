import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CopyAwaitingTtnButton } from './CopyAwaitingTtnButton'
import { ordersApi } from './orders.api'
import type { Order } from './orders.schema'
import { formatAwaitingTtnList, isAwaitingTtn } from './orders.utils'

vi.mock('./orders.api', () => ({ ordersApi: { getAllPages: vi.fn() } }))
vi.mock('react-hot-toast', () => {
	const fn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
	return { default: fn }
})

const getAllPages = vi.mocked(ordersApi.getAllPages)
const toastMock = vi.mocked(toast)

const order = (overrides: Partial<Order>): Order =>
	({
		id: 'id',
		order_number: 'FO-0000100',
		created_at: '2026-10-01T00:00:00.000Z',
		items: [],
		subtotal_price: 0,
		total_price: 0,
		customer: { name: 'Клієнт', phone: '+380991112233', email: '' },
		delivery_method: 'NOVA_POST',
		payment_method: 'COD',
		payment_status: 'PENDING',
		order_status: 'NEW',
		nova_post_ttn: null,
		status_history: [],
		...overrides
	}) as Order

describe('isAwaitingTtn', () => {
	it('is a delivery without a TTN that is still open', () => {
		expect(isAwaitingTtn(order({}))).toBe(true)
		expect(isAwaitingTtn(order({ delivery_method: 'COURIER' }))).toBe(true)
	})

	it('drops pickups, shipped orders and closed ones', () => {
		expect(isAwaitingTtn(order({ delivery_method: 'PICKUP' }))).toBe(false)
		expect(isAwaitingTtn(order({ nova_post_ttn: '20450000000001' }))).toBe(false)
		expect(isAwaitingTtn(order({ order_status: 'CANCELLED' }))).toBe(false)
		expect(isAwaitingTtn(order({ order_status: 'RETURNING' }))).toBe(false)
		expect(isAwaitingTtn(order({ order_status: 'RETURNED' }))).toBe(false)
	})
})

describe('formatAwaitingTtnList', () => {
	it('numbers the open deliveries from the oldest up, one blank line apart', () => {
		const text = formatAwaitingTtnList([
			order({
				order_number: 'FO-0000104',
				customer: { name: '', phone: '+380932667902', email: '' }
			}),
			order({
				order_number: 'FO-0000103',
				customer: { name: '', phone: '+380999223450', email: '' }
			}),
			order({ order_number: 'FO-0000102', delivery_method: 'PICKUP' }),
			order({ order_number: 'FO-0000101', nova_post_ttn: '20450000000001' })
		])
		expect(text).toBe(
			'1. Замовлення #FO-0000103\n+380999223450\n\n2. Замовлення #FO-0000104\n+380932667902'
		)
	})

	it('is empty when nothing waits for a TTN', () => {
		expect(formatAwaitingTtnList([order({ delivery_method: 'PICKUP' })])).toBe('')
	})
})

describe('CopyAwaitingTtnButton', () => {
	const writeText = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		writeText.mockResolvedValue(undefined)
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
	})
	afterEach(cleanup)

	const renderButton = (orderStatus: 'all' | Order['order_status'] = 'all') =>
		render(
			<QueryClientProvider client={new QueryClient()}>
				<CopyAwaitingTtnButton orderStatus={orderStatus} paymentStatus='all' />
			</QueryClientProvider>
		)

	it('copies every open delivery of the current filter and reports the count', async () => {
		getAllPages.mockResolvedValueOnce([
			order({ order_number: 'FO-0000110' }),
			order({ order_number: 'FO-0000109', delivery_method: 'PICKUP' })
		])
		renderButton('CONFIRMED')

		fireEvent.click(screen.getByRole('button', { name: /Скопіювати/ }))

		await waitFor(() =>
			expect(writeText).toHaveBeenCalledWith('1. Замовлення #FO-0000110\n+380991112233')
		)
		expect(getAllPages).toHaveBeenCalledWith({
			order_status: 'CONFIRMED',
			payment_status: undefined
		})
		expect(toastMock.success).toHaveBeenCalledWith('Скопійовано замовлень без ТТН: 1')
	})

	it('says so instead of copying an empty string', async () => {
		getAllPages.mockResolvedValueOnce([order({ nova_post_ttn: '20450000000001' })])
		renderButton()

		fireEvent.click(screen.getByRole('button', { name: /Скопіювати/ }))

		await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Немає замовлень без ТТН'))
		expect(writeText).not.toHaveBeenCalled()
	})

	it('reports a failed clipboard write', async () => {
		getAllPages.mockResolvedValueOnce([order({})])
		writeText.mockRejectedValueOnce(new Error('denied'))
		renderButton()

		fireEvent.click(screen.getByRole('button', { name: /Скопіювати/ }))

		await waitFor(() =>
			expect(toastMock.error).toHaveBeenCalledWith('Не вдалося скопіювати список')
		)
	})
})
