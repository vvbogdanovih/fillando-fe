import '@/common/lib/zod-locale'
import * as z from 'zod'

export const wholesaleInquiryStatusSchema = z.enum(['NEW', 'PROCESSED'])
export type WholesaleInquiryStatus = z.infer<typeof wholesaleInquiryStatusSchema>

export const wholesaleInquirySchema = z
	.object({
		id: z.string().optional(),
		_id: z.string().optional(),
		name: z.string(),
		phone: z.string(),
		email: z.string(),
		quantity: z.string(),
		comment: z.string().nullable().optional(),
		status: wholesaleInquiryStatusSchema,
		createdAt: z.string().optional()
	})
	.passthrough()
	.transform(value => ({
		...value,
		id: value.id ?? value._id ?? '',
		comment: value.comment ?? null
	}))
	.refine(value => value.id.length > 0, {
		message: 'Inquiry id is required'
	})

export const wholesaleInquiriesListResponseSchema = z.object({
	items: z.array(wholesaleInquirySchema),
	total: z.coerce.number().min(0),
	page: z.coerce.number().min(1),
	limit: z.coerce.number().min(1)
})

export type WholesaleInquiry = z.infer<typeof wholesaleInquirySchema>
export type WholesaleInquiriesListResponse = z.infer<typeof wholesaleInquiriesListResponseSchema>

export type ListWholesaleInquiriesQuery = {
	page?: number
	limit?: number
	status?: WholesaleInquiryStatus
}
