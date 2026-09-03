import '@/common/lib/zod-locale'
import * as z from 'zod'
import { paymentMethodValues, paymentStatusValues } from '@/app/(root)/profile/orders/orders.schema'

const validatedCouponSchema = z.object({
	id: z.string(),
	number: z.union([z.string(), z.number()]).transform(value => String(value)),
	code: z.string(),
	discount_percent: z.coerce.number(),
	valid_until: z.string()
})

export const validateCouponResponseSchema = z.discriminatedUnion('valid', [
	z.object({
		valid: z.literal(true),
		coupon: validatedCouponSchema
	}),
	z.object({
		valid: z.literal(false),
		reason: z.enum(['NOT_FOUND', 'INACTIVE', 'EXPIRED'])
	})
])

export const createOrderResponseSchema = z.object({
	order_number: z.union([z.string(), z.number()]),
	subtotal_price: z.coerce.number().optional(),
	total_price: z.coerce.number().optional(),
	applied_discount: z
		.object({
			code: z.string(),
			discount_percent: z.coerce.number(),
			discount_amount: z.coerce.number()
		})
		.nullable()
		.optional(),
	/** Present only for LIQPAY orders — authorises the public payment-status lookup. */
	payment_access_token: z.string().optional()
})

/** `GET /orders/lookup/:orderNumber?token=` — public, token-scoped payment status. */
export const orderPaymentStatusSchema = z.object({
	order_number: z.string(),
	payment_method: z.enum(paymentMethodValues),
	payment_status: z.enum(paymentStatusValues),
	total_price: z.number()
})

export type ValidateCouponResponse = z.infer<typeof validateCouponResponseSchema>
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>
