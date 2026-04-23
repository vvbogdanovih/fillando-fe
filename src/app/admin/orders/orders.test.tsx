import { render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OrderItemsList } from './orders.components'
import { type Order } from './orders.schema'
import { buildOrderPatchPayload, mapOrderErrorMessage } from './orders.utils'

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ''} />
}))

const baseOrder: Order = {
	id: 'order-id',
	_id: 'order-id',
	number: 11,
	order_number: 11,
	created_at: '2026-04-10T12:00:00.000Z',
	createdAt: '2026-04-10T12:00:00.000Z',
	items: [
		{
			variant_id: 'v1',
			image: 'https://example.com/image.jpg',
			name: 'PLA 1kg',
			sku: 'SKU-1',
			vendor_sku: 'VSKU-1',
			quantity: 2,
			price: 300,
			line_total: 600
		}
	],
	subtotal_price: 600,
	total_price: 600,
	applied_discount: null,
	customer: {
		name: 'Іван',
		phone: '+380000000000',
		email: 'ivan@example.com'
	},
	delivery_method: 'NOVA_POST',
	delivery_address: {
		city_name: 'Київ',
		warehouse_description: 'Відділення №1',
		warehouse_number: '1'
	},
	payment_method: 'CARD',
	payment_status: 'PENDING',
	order_status: 'PENDING',
	comment: '',
	nova_post_ttn: ''
}

describe('orders UI critical flows', () => {
	it('renders order items with sku and vendor sku', () => {
		render(<OrderItemsList items={baseOrder.items} />)

		expect(screen.getByText('PLA 1kg')).toBeInTheDocument()
		expect(screen.getByText(/SKU: SKU-1/)).toBeInTheDocument()
		expect(screen.getByText(/Vendor SKU: VSKU-1/)).toBeInTheDocument()
		expect(screen.getByText('К-сть: 2')).toBeInTheDocument()
	})

	it('builds PATCH payload with changed fields only', () => {
		const payload = buildOrderPatchPayload(baseOrder, {
			customer: {
				name: 'Петро',
				phone: '+380000000000',
				email: 'ivan@example.com'
			},
			delivery_method: 'NOVA_POST',
			delivery_address: {
				city_name: 'Київ',
				warehouse_description: 'Відділення №1',
				warehouse_number: '1'
			},
			payment_method: 'CARD',
			comment: 'Передзвоніть',
			items: [
				{
					variant_id: 'v1',
					quantity: 3
				}
			]
		})

		expect(payload).toEqual({
			customer: {
				name: 'Петро',
				phone: '+380000000000',
				email: 'ivan@example.com'
			},
			comment: 'Передзвоніть',
			items: [
				{
					variant_id: 'v1',
					quantity: 3
				}
			]
		})
	})

	it('maps backend errors to user-friendly messages', () => {
		expect(mapOrderErrorMessage('404 order not found')).toContain('(404)')
		expect(mapOrderErrorMessage('400 validation failed')).toContain('(400)')
	})
})
