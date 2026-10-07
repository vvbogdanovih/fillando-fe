import '@/common/lib/zod-locale'
import * as z from 'zod'

export const orderStatusValues = [
	'NEW',
	'PROCESSING',
	'CONFIRMED',
	'SHIPPED',
	'DELIVERED',
	'COMPLETED',
	'CANCELLED',
	'RETURNING',
	'RETURNED'
] as const

export const paymentStatusValues = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'VOIDED'] as const

export const statusActorValues = ['admin', 'customer', 'tracker', 'gateway', 'system'] as const

export const deliveryMethodValues = ['NOVA_POST', 'COURIER', 'PICKUP'] as const

export const paymentMethodValues = ['CASH', 'CARD', 'LIQPAY', 'MONOPAY', 'IBAN', 'COD'] as const

const parseOptionalNumber = (value: unknown): number | undefined => {
	if (value === null || value === undefined || value === '') return undefined
	const num = Number(value)
	return Number.isFinite(num) ? num : undefined
}

const parseNumberWithDefault = (value: unknown, fallback = 0): number => {
	const parsed = parseOptionalNumber(value)
	return parsed ?? fallback
}

const toUpperValue = (value: unknown): string | undefined =>
	typeof value === 'string' ? value.trim().toUpperCase() : undefined

const statusHistoryEntrySchema = z.object({
	field: z.enum(['order_status', 'payment_status']),
	from: z.string().nullable().optional(),
	to: z.string(),
	at: z.string(),
	actor: z.enum(statusActorValues).catch('system'),
	note: z.string().optional()
})

const customerSchema = z.object({
	name: z.string().optional().default(''),
	phone: z.string().optional().default(''),
	email: z.string().optional().default('')
})

const orderItemSchema = z.object({
	variant_id: z.string().optional(),
	image: z.string().nullable().optional(),
	name: z.string(),
	sku: z.string().nullable().optional(),
	vendor_sku: z.string().nullable().optional(),
	quantity: z.preprocess(value => parseNumberWithDefault(value, 1), z.number()),
	price: z.preprocess(value => parseOptionalNumber(value), z.number().optional()),
	line_total: z.preprocess(value => parseNumberWithDefault(value, 0), z.number())
})

const novaPostAddressSchema = z.object({
	city_name: z.string().optional().default(''),
	warehouse_description: z.string().optional().default(''),
	warehouse_number: z.string().optional().default('')
})

const courierAddressSchema = z.object({
	city_name: z.string().optional().default(''),
	street: z.string().optional().default(''),
	building: z.string().optional().default(''),
	apartment: z.string().optional().default('')
})

const pickupAddressSchema = z.object({}).passthrough()

const deliveryAddressSchema = z
	.union([novaPostAddressSchema, courierAddressSchema, pickupAddressSchema])
	.nullable()
	.optional()

const appliedDiscountSchema = z.object({
	code: z.string(),
	discount_percent: z.number(),
	discount_amount: z.number()
})

/** The admin's fixed UAH discount granted after checkout; `reason` is admin-only. */
const manualDiscountSchema = z.object({
	amount: z.number(),
	reason: z.string().optional(),
	applied_at: z.string().optional()
})

export const orderSchema = z
	.object({
		_id: z.string().optional(),
		id: z.string().optional(),
		number: z.union([z.string(), z.number()]).optional(),
		order_number: z.union([z.string(), z.number()]).optional(),
		created_at: z.string().optional(),
		createdAt: z.string().optional(),
		items: z.array(orderItemSchema).default([]),
		subtotal_price: z
			.preprocess(value => parseNumberWithDefault(value, 0), z.number())
			.default(0),
		total_price: z.preprocess(value => parseNumberWithDefault(value, 0), z.number()).default(0),
		// The backend sends the coupon snapshot object; reading it as a number made it NaN and
		// hid the coupon line from the summary.
		applied_discount: appliedDiscountSchema.nullable().optional().catch(null),
		manual_discount: manualDiscountSchema.nullable().optional().catch(null),
		customer: customerSchema.default({ name: '', phone: '', email: '' }),
		delivery_method: z
			.preprocess(value => toUpperValue(value), z.enum(deliveryMethodValues))
			.catch('PICKUP'),
		delivery_address: deliveryAddressSchema,
		payment_method: z
			.preprocess(value => toUpperValue(value), z.enum(paymentMethodValues))
			.catch('CASH'),
		payment_status: z
			.preprocess(value => toUpperValue(value), z.enum(paymentStatusValues))
			.catch('PENDING'),
		order_status: z
			.preprocess(value => toUpperValue(value), z.enum(orderStatusValues))
			.catch('NEW'),
		comment: z.string().nullable().optional(),
		nova_post_ttn: z.string().nullable().optional(),
		// Admin responses only (TD-0011). Parsed entry by entry, so one row this build cannot
		// read (a field or actor added later) drops that row, not the whole audit trail.
		status_history: z
			.array(z.unknown())
			.catch([])
			.default([])
			.transform(rows =>
				rows.flatMap(row => {
					const parsed = statusHistoryEntrySchema.safeParse(row)
					return parsed.success ? [parsed.data] : []
				})
			),
		// `undefined` means the backend does not send the field at all (older build) — a
		// different situation from «nothing is allowed», and the UI says so. An unknown status
		// from a newer backend is dropped rather than failing the order.
		allowed_status_transitions: z
			.array(z.string())
			.optional()
			.catch(undefined)
			.transform(values =>
				values?.filter((value): value is OrderStatus =>
					(orderStatusValues as readonly string[]).includes(value)
				)
			),
		/** Whether saving a TTN will ship this order — the backend's `shipsOnTtn`, not a mirror. */
		ships_on_ttn: z.boolean().optional().catch(undefined)
	})
	.passthrough()
	.transform(data => ({
		...data,
		id: data.id ?? data._id ?? '',
		order_number: String(data.order_number ?? data.number ?? '—'),
		created_at: data.created_at ?? data.createdAt ?? new Date().toISOString()
	}))

export const ordersListResponseSchema = z
	.object({
		items: z.array(orderSchema).optional(),
		orders: z.array(orderSchema).optional(),
		data: z.array(orderSchema).optional(),
		page: z.preprocess(value => parseNumberWithDefault(value, 1), z.number()).default(1),
		limit: z.preprocess(value => parseNumberWithDefault(value, 20), z.number()).default(20),
		total: z.preprocess(value => parseNumberWithDefault(value, 0), z.number()).default(0)
	})
	.passthrough()
	.transform(data => ({
		...data,
		items: data.items ?? data.orders ?? data.data ?? []
	}))

export const patchOrderSchema = z.object({
	customer: customerSchema.optional(),
	delivery_method: z.enum(deliveryMethodValues).optional(),
	delivery_address: z.record(z.string(), z.unknown()).optional(),
	payment_method: z.enum(paymentMethodValues).optional(),
	comment: z.string().nullable().optional(),
	items: z
		.array(
			z.object({
				variant_id: z.string(),
				quantity: z.number().int().positive()
			})
		)
		.optional(),
	manual_discount: z
		.object({ amount: z.number().positive(), reason: z.string().min(1) })
		.nullable()
		.optional()
})

export type OrderStatus = (typeof orderStatusValues)[number]
export type PaymentStatus = (typeof paymentStatusValues)[number]
export type DeliveryMethod = (typeof deliveryMethodValues)[number]
export type PaymentMethod = (typeof paymentMethodValues)[number]

export type Order = z.infer<typeof orderSchema>
export type StatusHistoryEntry = z.infer<typeof statusHistoryEntrySchema>
export type StatusActor = (typeof statusActorValues)[number]
export type OrderItem = z.infer<typeof orderItemSchema>
export type OrdersListResponse = z.infer<typeof ordersListResponseSchema>
export type PatchOrderPayload = z.infer<typeof patchOrderSchema>

/** Mirrors the backend `InvoiceAudience`: the `customer` copy omits the supplier article. */
export type InvoiceAudience = 'internal' | 'customer'

export interface OrdersListQuery {
	page?: number
	limit?: number
	order_status?: OrderStatus
	payment_status?: PaymentStatus
}

export interface PatchOrderStatusPayload {
	order_status: OrderStatus
}

export interface PatchPaymentStatusPayload {
	payment_status: PaymentStatus
}

export interface PatchTtnPayload {
	nova_post_ttn: string
}

export interface GenerateReportPayload {
	date_from: string
	date_to: string
	/** Statuses to include; absent means every status. */
	order_status?: OrderStatus[]
	payment_status?: PaymentStatus[]
}
