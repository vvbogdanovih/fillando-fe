import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrderStatusActions } from './OrderStatusActions'
import { orderSchema, type Order } from './orders.schema'
import { StatusHistoryCard } from './StatusHistoryCard'

afterEach(cleanup)

const order = (overrides: Record<string, unknown> = {}): Order =>
	orderSchema.parse({
		_id: 'o1',
		order_number: 'FO-0000001',
		createdAt: '2026-10-03T10:00:00.000Z',
		items: [],
		customer: { name: 'Іван', phone: '+380000000000', email: 'i@example.com' },
		delivery_method: 'NOVA_POST',
		payment_method: 'COD',
		payment_status: 'PENDING',
		order_status: 'NEW',
		allowed_status_transitions: ['PROCESSING', 'CONFIRMED', 'CANCELLED'],
		...overrides
	})

describe('orderSchema — TD-0011 fields', () => {
	it('drops a transition this build does not know instead of failing the order', () => {
		expect(
			order({ allowed_status_transitions: ['CONFIRMED', 'ON_HOLD'] })
				.allowed_status_transitions
		).toEqual(['CONFIRMED'])
	})

	it('tells a missing field apart from an empty list', () => {
		const parsed = order({ allowed_status_transitions: undefined })
		expect(parsed.allowed_status_transitions).toBeUndefined()
		expect(parsed.status_history).toEqual([])
		expect(order({ allowed_status_transitions: [] }).allowed_status_transitions).toEqual([])
	})

	it('drops one unreadable history row, not the whole history', () => {
		const parsed = order({
			status_history: [
				{
					field: 'order_status',
					from: null,
					to: 'NEW',
					at: '2026-10-01T10:00:00.000Z',
					actor: 'customer'
				},
				{
					field: 'nova_post_ttn',
					from: null,
					to: '1',
					at: '2026-10-01T10:00:00.000Z',
					actor: 'admin'
				}
			]
		})
		expect(parsed.status_history).toHaveLength(1)
		expect(parsed.status_history[0].to).toBe('NEW')
	})
})

describe('OrderStatusActions', () => {
	// Radix opens its menu on pointerdown or on a key, not on a synthetic click.
	const open = () => fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
	const item = (label: string) => screen.getByRole('menuitemradio', { name: label })
	const isDisabled = (label: string) => item(label).getAttribute('aria-disabled') === 'true'

	it('lists every status and enables only what the server allows plus the current one', () => {
		render(<OrderStatusActions order={order()} onTransition={vi.fn()} isPending={false} />)
		open()

		expect(screen.getAllByRole('menuitemradio')).toHaveLength(9)
		expect(isDisabled('Нове')).toBe(false)
		expect(isDisabled('Очікує підтвердження')).toBe(false)
		expect(isDisabled('Підтверджено')).toBe(false)
		expect(isDisabled('Скасовано')).toBe(false)
		expect(isDisabled('Відправлено')).toBe(true)
		expect(isDisabled('Доставлено')).toBe(true)
		expect(isDisabled('Виконано')).toBe(true)
		expect(isDisabled('Повертається')).toBe(true)
		expect(isDisabled('Повернено')).toBe(true)
	})

	it('sends the chosen status', () => {
		const onTransition = vi.fn()
		render(<OrderStatusActions order={order()} onTransition={onTransition} isPending={false} />)
		open()
		fireEvent.click(item('Очікує підтвердження'))
		expect(onTransition).toHaveBeenCalledWith('PROCESSING')
	})

	it('does not send the current status again', () => {
		const onTransition = vi.fn()
		render(<OrderStatusActions order={order()} onTransition={onTransition} isPending={false} />)
		open()
		fireEvent.click(item('Нове'))
		expect(onTransition).not.toHaveBeenCalled()
	})

	it('restricts nothing when the backend sends no list at all', () => {
		render(
			<OrderStatusActions
				order={order({ allowed_status_transitions: undefined })}
				onTransition={vi.fn()}
				isPending={false}
			/>
		)
		open()
		expect(
			screen
				.getAllByRole('menuitemradio')
				.every(el => el.getAttribute('aria-disabled') !== 'true')
		).toBe(true)
	})

	it('leaves only the current status enabled on a closed order', () => {
		render(
			<OrderStatusActions
				order={order({ order_status: 'RETURNED', allowed_status_transitions: [] })}
				onTransition={vi.fn()}
				isPending={false}
			/>
		)
		open()
		expect(isDisabled('Повернено')).toBe(false)
		expect(isDisabled('Нове')).toBe(true)
	})
})

describe('StatusHistoryCard', () => {
	it('lists changes newest first with who made them', () => {
		const { status_history } = order({
			status_history: [
				{
					field: 'order_status',
					from: null,
					to: 'NEW',
					at: '2026-10-01T10:00:00.000Z',
					actor: 'customer'
				},
				{
					field: 'order_status',
					from: 'CONFIRMED',
					to: 'SHIPPED',
					at: '2026-10-02T10:00:00.000Z',
					actor: 'admin',
					note: 'ТТН 20450081729182'
				}
			]
		})
		render(<StatusHistoryCard history={status_history} />)

		const items = screen.getAllByRole('listitem')
		expect(items[0]).toHaveTextContent('Підтверджено → Відправлено')
		expect(items[0]).toHaveTextContent('ТТН 20450081729182')
		expect(items[0]).toHaveTextContent('Адмін')
		expect(items[1]).toHaveTextContent('Замовлення: Нове')
		expect(items[1]).toHaveTextContent('Покупець')
	})
})
