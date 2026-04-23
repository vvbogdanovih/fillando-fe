import { z } from 'zod'

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
		.optional()
})

export type ValidateCouponResponse = z.infer<typeof validateCouponResponseSchema>
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>
