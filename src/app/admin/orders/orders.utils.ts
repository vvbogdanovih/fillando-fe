import type { DeliveryMethod, Order, PatchOrderPayload, PaymentMethod } from './orders.schema'

/**
 * Delivery methods each payment method is limited to. A method absent from this
 * map is unrestricted — mirrors `ALLOWED_DELIVERY_BY_PAYMENT` on the backend,
 * which is what actually rejects a broken pair with a 400. `CASH` is deliberately
 * absent: the storefront limits it to self-pickup, but the backend does not, so
 * the admin can still fix an existing order.
 */
const ALLOWED_DELIVERY_BY_PAYMENT: Partial<Record<PaymentMethod, DeliveryMethod[]>> = {
	COD: ['NOVA_POST', 'COURIER']
}

export const isPaymentMethodAllowed = (
	paymentMethod: PaymentMethod,
	deliveryMethod: DeliveryMethod
): boolean => {
	const allowed = ALLOWED_DELIVERY_BY_PAYMENT[paymentMethod]
	return !allowed || allowed.includes(deliveryMethod)
}

export const formatPrice = (value: number): string =>
	new Intl.NumberFormat('uk-UA', {
		style: 'currency',
		currency: 'UAH',
		maximumFractionDigits: 0
	}).format(value)

export const formatDate = (value: string): string => {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return '—'
	return date.toLocaleString('uk-UA')
}

export const formatCustomerShort = (order: Order): string => {
	const name = order.customer?.name || '—'
	const phone = order.customer?.phone || '—'
	return `${name} · ${phone}`
}

export const buildOrderPatchPayload = (
	initial: Order,
	values: PatchOrderPayload
): Partial<PatchOrderPayload> => {
	const patch: Partial<PatchOrderPayload> = {}

	if (values.customer) {
		const hasCustomerChanges =
			values.customer.name !== initial.customer.name ||
			values.customer.phone !== initial.customer.phone ||
			values.customer.email !== initial.customer.email
		if (hasCustomerChanges) patch.customer = values.customer
	}

	if (values.delivery_method && values.delivery_method !== initial.delivery_method) {
		patch.delivery_method = values.delivery_method
	}

	if (values.delivery_address) {
		const current = JSON.stringify(initial.delivery_address ?? {})
		const next = JSON.stringify(values.delivery_address ?? {})
		if (current !== next) patch.delivery_address = values.delivery_address
	}

	if (values.payment_method && values.payment_method !== initial.payment_method) {
		patch.payment_method = values.payment_method
	}

	if ((values.comment ?? null) !== (initial.comment ?? null)) {
		patch.comment = values.comment ?? null
	}

	if (values.items) {
		const initialItems = (initial.items ?? []).map(item => ({
			variant_id: item.variant_id ?? '',
			quantity: item.quantity
		}))
		const nextItems = values.items.map(item => ({
			variant_id: item.variant_id,
			quantity: item.quantity
		}))
		if (JSON.stringify(initialItems) !== JSON.stringify(nextItems)) {
			patch.items = nextItems
		}
	}

	return patch
}

export const mapOrderErrorMessage = (errorMessage: string): string => {
	const normalized = errorMessage.toLowerCase()
	if (normalized.includes('404') || normalized.includes('not found')) {
		return 'Замовлення не знайдено (404)'
	}
	if (normalized.includes('400') || normalized.includes('validation')) {
		return 'Некоректні дані запиту (400). Перевірте поля форми.'
	}
	return errorMessage || 'Сталася помилка під час оновлення замовлення'
}
