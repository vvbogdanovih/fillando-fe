import { describe, expect, it } from 'vitest'
import { isPaymentMethodAllowed } from './checkout.constants'
import { checkoutFormSchema, type CheckoutFormValues } from './checkout.schema'

const novaPostValues: CheckoutFormValues = {
	customer: { name: 'Іван', phone: '+380501234567', email: 'ivan@example.com' },
	delivery_method: 'NOVA_POST',
	payment_method: 'IBAN',
	city_ref: 'city-ref',
	city_name: 'Київ',
	warehouse_type: 'POST',
	warehouse_number: 1,
	warehouse_description: 'Відділення №1'
}

const courierValues: CheckoutFormValues = {
	customer: novaPostValues.customer,
	delivery_method: 'COURIER',
	payment_method: 'IBAN',
	courier_city_name: 'Київ',
	courier_street: 'Хрещатик',
	courier_building: '1'
}

const pickupValues: CheckoutFormValues = {
	customer: novaPostValues.customer,
	delivery_method: 'PICKUP',
	payment_method: 'CASH'
}

const paymentMethodIssues = (values: CheckoutFormValues): string[] => {
	const result = checkoutFormSchema.safeParse(values)
	if (result.success) return []
	return result.error.issues
		.filter(issue => issue.path[0] === 'payment_method')
		.map(issue => issue.message)
}

describe('checkoutFormSchema — накладний платіж', () => {
	it('accepts COD for a Nova Post warehouse delivery', () => {
		expect(paymentMethodIssues({ ...novaPostValues, payment_method: 'COD' })).toEqual([])
	})

	it('accepts COD for a Nova Post courier delivery', () => {
		expect(paymentMethodIssues({ ...courierValues, payment_method: 'COD' })).toEqual([])
	})

	it('rejects COD for self-pickup', () => {
		expect(paymentMethodIssues({ ...pickupValues, payment_method: 'COD' })).toEqual([
			'Накладний платіж доступний лише при доставці Новою Поштою'
		])
	})

	it('still rejects cash outside self-pickup', () => {
		expect(paymentMethodIssues({ ...novaPostValues, payment_method: 'CASH' })).toEqual([
			'Готівка доступна тільки при самовивозі'
		])
	})
})

describe('isPaymentMethodAllowed', () => {
	it('limits COD to Nova Post deliveries', () => {
		expect(isPaymentMethodAllowed('COD', 'NOVA_POST')).toBe(true)
		expect(isPaymentMethodAllowed('COD', 'COURIER')).toBe(true)
		expect(isPaymentMethodAllowed('COD', 'PICKUP')).toBe(false)
	})

	it('limits cash to self-pickup', () => {
		expect(isPaymentMethodAllowed('CASH', 'PICKUP')).toBe(true)
		expect(isPaymentMethodAllowed('CASH', 'NOVA_POST')).toBe(false)
	})

	it('leaves the other methods unrestricted', () => {
		expect(isPaymentMethodAllowed('IBAN', 'PICKUP')).toBe(true)
		expect(isPaymentMethodAllowed('LIQPAY', 'NOVA_POST')).toBe(true)
	})
})
