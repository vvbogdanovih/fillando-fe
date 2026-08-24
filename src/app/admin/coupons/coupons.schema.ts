import '@/common/lib/zod-locale'
import * as z from 'zod'

export const couponCodeRegex = /^[A-Z0-9]{10}$/

export const couponSchema = z
	.object({
		id: z.string().optional(),
		_id: z.string().optional(),
		number: z.union([z.string(), z.number()]).transform(value => String(value)),
		code: z.string().regex(couponCodeRegex, 'Некоректний формат коду купона'),
		discount_percent: z.coerce.number().min(0).max(100),
		valid_until: z.string(),
		is_active: z.boolean(),
		// old documents created before the reusable feature lack these fields (lean reads skip defaults)
		is_reusable: z.boolean().optional().default(false),
		used_count: z.coerce.number().min(0).optional().default(0),
		createdAt: z.string().optional(),
		updatedAt: z.string().optional()
	})
	.passthrough()
	.transform(value => ({
		...value,
		id: value.id ?? value._id ?? ''
	}))
	.refine(value => value.id.length > 0, {
		message: 'Coupon id is required'
	})

export const couponsListResponseSchema = z.object({
	items: z.array(couponSchema),
	total: z.coerce.number().min(0),
	page: z.coerce.number().min(1),
	limit: z.coerce.number().min(1)
})

const validDateTimeMessage = 'Вкажіть коректну дату завершення'

export const couponFormSchema = z.object({
	discount_percent: z.number().min(0, 'Мінімум 0%').max(100, 'Максимум 100%'),
	valid_until: z
		.string()
		.min(1, 'Дата завершення обовʼязкова')
		.refine(value => !Number.isNaN(new Date(value).getTime()), validDateTimeMessage),
	is_active: z.boolean(),
	is_reusable: z.boolean()
})

export type Coupon = z.infer<typeof couponSchema>
export type CouponFormValues = z.infer<typeof couponFormSchema>
export type CouponsListResponse = z.infer<typeof couponsListResponseSchema>

export type ListCouponsQuery = {
	page?: number
	limit?: number
	is_active?: boolean
	q?: string
}

export type CreateCouponPayload = {
	discount_percent: number
	valid_until: string
	is_active?: boolean
	is_reusable?: boolean
}

export type UpdateCouponPayload = {
	discount_percent?: number
	valid_until?: string
	is_active?: boolean
	is_reusable?: boolean
}
