import {
	orderStatusValues,
	paymentStatusValues,
	type DeliveryMethod,
	type Order,
	type OrderStatus,
	type PatchOrderPayload,
	type PaymentMethod,
	type PaymentStatus
} from './orders.schema'

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

export const ORDERS_LIMIT_OPTIONS = [10, 20, 50] as const
export const DEFAULT_ORDERS_LIMIT = 20

export interface OrdersListParams {
	page: number
	limit: number
	orderStatus: 'all' | OrderStatus
	paymentStatus: 'all' | PaymentStatus
}

/**
 * The order list lives in the URL (`?page=3&limit=50&order_status=SHIPPED`), so a reload, a
 * shared link or the back button from an order returns to the same page and filters. Anything
 * unparseable falls back to the default rather than producing an empty or broken list.
 */
export function parseOrdersListParams(params: URLSearchParams): OrdersListParams {
	const page = Number(params.get('page'))
	const limit = Number(params.get('limit'))
	const orderStatus = params.get('order_status')
	const paymentStatus = params.get('payment_status')
	return {
		page: Number.isInteger(page) && page > 1 ? page : 1,
		limit: (ORDERS_LIMIT_OPTIONS as readonly number[]).includes(limit)
			? limit
			: DEFAULT_ORDERS_LIMIT,
		orderStatus: (orderStatusValues as readonly string[]).includes(orderStatus ?? '')
			? (orderStatus as OrderStatus)
			: 'all',
		paymentStatus: (paymentStatusValues as readonly string[]).includes(paymentStatus ?? '')
			? (paymentStatus as PaymentStatus)
			: 'all'
	}
}

/**
 * The query string for a list state. Defaults are left out so the plain address stays plain;
 * changing a filter or the page size starts again from page 1, because page 7 of the old
 * selection usually does not exist in the new one.
 */
export function ordersListQuery(next: OrdersListParams): string {
	const query = new URLSearchParams()
	if (next.page > 1) query.set('page', String(next.page))
	if (next.limit !== DEFAULT_ORDERS_LIMIT) query.set('limit', String(next.limit))
	if (next.orderStatus !== 'all') query.set('order_status', next.orderStatus)
	if (next.paymentStatus !== 'all') query.set('payment_status', next.paymentStatus)
	const value = query.toString()
	return value ? `?${value}` : ''
}
