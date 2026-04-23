import { z } from 'zod'

export const orderStatusValues = [
	'PENDING',
	'CONFIRMED',
	'PROCESSING',
	'SHIPPED',
	'DELIVERED',
	'CANCELLED'
] as const

export const paymentStatusValues = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const

export const deliveryMethodValues = ['NOVA_POST', 'COURIER', 'PICKUP'] as const

export const paymentMethodValues = ['CASH', 'CARD', 'LIQPAY', 'MONOPAY', 'IBAN'] as const

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

export const orderSchema = z
	.object({
		_id: z.string().optional(),
		id: z.string().optional(),
		number: z.union([z.string(), z.number()]).optional(),
		order_number: z.union([z.string(), z.number()]).optional(),
		created_at: z.string().optional(),
		createdAt: z.string().optional(),
		items: z.array(orderItemSchema).default([]),
		subtotal_price: z.preprocess(value => parseNumberWithDefault(value, 0), z.number()).default(0),
		total_price: z.preprocess(value => parseNumberWithDefault(value, 0), z.number()).default(0),
		applied_discount: z.preprocess(value => parseOptionalNumber(value), z.number().optional().nullable()),
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
			.catch('PENDING'),
		comment: z.string().nullable().optional(),
		nova_post_ttn: z.string().nullable().optional()
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
		.optional()
})

export type OrderStatus = (typeof orderStatusValues)[number]
export type PaymentStatus = (typeof paymentStatusValues)[number]
export type DeliveryMethod = (typeof deliveryMethodValues)[number]
export type PaymentMethod = (typeof paymentMethodValues)[number]

export type Order = z.infer<typeof orderSchema>
export type OrderItem = z.infer<typeof orderItemSchema>
export type OrdersListResponse = z.infer<typeof ordersListResponseSchema>
export type PatchOrderPayload = z.infer<typeof patchOrderSchema>

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
