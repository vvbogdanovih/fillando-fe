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

export const ORDERS_LIMIT_VALUES = [10, 20, 50] as const
const DEFAULT_ORDERS_LIMIT = 20

export interface OrdersListParams {
	page: number
	limit: number
	orderStatus: 'all' | OrderStatus
	paymentStatus: 'all' | PaymentStatus
}

/**
 * The list's page, page size and filters live in the URL, so «Назад» from an order returns to
 * the page it was opened from. Anything the URL carries that the list cannot use — a hand-edited
 * `?page=abc`, an unknown status — falls back to the default instead of reaching the API.
 */
export const parseOrdersListParams = (params: URLSearchParams): OrdersListParams => {
	const page = Number(params.get('page'))
	const limit = Number(params.get('limit'))
	const orderStatus = params.get('order_status')
	const paymentStatus = params.get('payment_status')

	return {
		page: Number.isInteger(page) && page > 1 ? page : 1,
		limit: (ORDERS_LIMIT_VALUES as readonly number[]).includes(limit)
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

/** The query string for `params`; defaults are left out, so the first page is the bare address. */
export const buildOrdersListSearch = (params: OrdersListParams): string => {
	const search = new URLSearchParams()
	if (params.orderStatus !== 'all') search.set('order_status', params.orderStatus)
	if (params.paymentStatus !== 'all') search.set('payment_status', params.paymentStatus)
	if (params.limit !== DEFAULT_ORDERS_LIMIT) search.set('limit', String(params.limit))
	if (params.page > 1) search.set('page', String(params.page))
	const query = search.toString()
	return query ? `?${query}` : ''
}
