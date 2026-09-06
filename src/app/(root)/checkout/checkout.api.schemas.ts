import '@/common/lib/zod-locale'
import * as z from 'zod'
import {
	deliveryMethodValues,
	orderStatusValues,
	paymentMethodValues,
	paymentStatusValues
} from '@/app/(root)/profile/orders/orders.schema'

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

/**
 * `GET /orders/lookup/:orderNumber?token=` — public, token-scoped payment status. The last four
 * fields arrived with TD-0009 and are optional so the page keeps working on an older backend:
 * a missing `can_change_payment_method` reads as "no", a missing `liqpay_retry_after_seconds`
 * as "unknown" (the pre-TD-0009 behaviour: wait out the polling window).
 */
export const orderPaymentStatusSchema = z.object({
	order_number: z.string(),
	payment_method: z.enum(paymentMethodValues),
	payment_status: z.enum(paymentStatusValues),
	total_price: z.number(),
	order_status: z.enum(orderStatusValues).optional(),
	delivery_method: z.enum(deliveryMethodValues).optional(),
	can_change_payment_method: z.boolean().optional(),
	/** null — no card session was ever opened; 0 — may open one now; n — seconds to wait. */
	liqpay_retry_after_seconds: z.number().nullable().optional()
})

export type ValidateCouponResponse = z.infer<typeof validateCouponResponseSchema>
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>
