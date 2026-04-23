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
	price: z.preprocess(value => parseOptionalNumber(value), z.number().optional()),
	quantity: z.preprocess(value => parseNumberWithDefault(value, 1), z.number()),
	line_total: z.preprocess(value => parseNumberWithDefault(value, 0), z.number())
})

const deliveryAddressSchema = z.record(z.string(), z.unknown()).nullable().optional()

export const myOrderSchema = z
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
		delivery_method: z.preprocess(value => toUpperValue(value), z.enum(deliveryMethodValues)),
		delivery_address: deliveryAddressSchema,
		payment_method: z.preprocess(value => toUpperValue(value), z.enum(paymentMethodValues)),
		payment_status: z.preprocess(value => toUpperValue(value), z.enum(paymentStatusValues)),
		order_status: z.preprocess(value => toUpperValue(value), z.enum(orderStatusValues)),
		comment: z.string().nullable().optional()
	})
	.passthrough()
	.transform(data => ({
		...data,
		id: data.id ?? data._id ?? '',
		order_number: String(data.order_number ?? data.number ?? '—'),
		created_at: data.created_at ?? data.createdAt ?? new Date().toISOString()
	}))

export const myOrdersListResponseSchema = z.object({
	items: z.array(myOrderSchema),
	total: z.preprocess(value => parseNumberWithDefault(value, 0), z.number()).default(0),
	page: z.preprocess(value => parseNumberWithDefault(value, 1), z.number()).default(1),
	limit: z.preprocess(value => parseNumberWithDefault(value, 20), z.number()).default(20)
})

export type OrderStatus = (typeof orderStatusValues)[number]
export type PaymentStatus = (typeof paymentStatusValues)[number]
export type DeliveryMethod = (typeof deliveryMethodValues)[number]
export type PaymentMethod = (typeof paymentMethodValues)[number]

export type MyOrder = z.infer<typeof myOrderSchema>
export type MyOrderItem = z.infer<typeof orderItemSchema>
export type MyOrdersListResponse = z.infer<typeof myOrdersListResponseSchema>

export interface MyOrdersQuery {
	page?: number
	limit?: number
	order_status?: OrderStatus
	payment_status?: PaymentStatus
}
