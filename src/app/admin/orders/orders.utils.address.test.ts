import { describe, expect, it } from 'vitest'
import { buildOrderPatchPayload, normalizeDeliveryAddress } from './orders.utils'
import type { Order } from './orders.schema'

const stored = {
	city_name: 'Львів',
	warehouse_description: 'Відділення №5',
	warehouse_number: 5,
	street: null,
	building: null,
	apartment: null
}
const order = {
	customer: { name: 'Іван', phone: '+380991234567', email: 'a@b.c' },
	delivery_method: 'NOVA_POST',
	delivery_address: stored,
	payment_method: 'COD',
	comment: null,
	items: []
} as unknown as Order

describe('admin order edit — the delivery address', () => {
	it('sends a retyped warehouse number as a number, not as the input text', () => {
		const patch = buildOrderPatchPayload(order, {
			delivery_address: { ...stored, warehouse_number: '7' }
		})
		expect(patch.delivery_address).toEqual({ ...stored, warehouse_number: 7 })
	})

	it('treats the same number retyped as no change', () => {
		const patch = buildOrderPatchPayload(order, {
			delivery_address: { ...stored, warehouse_number: ' 5 ' }
		})
		expect(patch.delivery_address).toBeUndefined()
	})

	it('leaves an emptied number out for the backend to refuse in its own words', () => {
		expect(normalizeDeliveryAddress({ city_name: 'Львів', warehouse_number: '' })).toEqual({
			city_name: 'Львів'
		})
	})

	it('refuses a number that is not one before the request leaves', () => {
		expect(() => normalizeDeliveryAddress({ warehouse_number: '12а' })).toThrow(
			'Номер відділення має бути числом'
		)
	})
})
