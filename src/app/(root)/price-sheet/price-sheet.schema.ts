import '@/common/lib/zod-locale'
import * as z from 'zod'

export const adminVariantSchema = z.object({
	id: z.string(),
	slug: z.string(),
	image: z.string().nullable(),
	name: z.string(),
	manufacturer: z.string().nullable(),
	material: z.string().nullable(),
	color: z.string().nullable(),
	article: z.string().nullable(),
	price: z.number(),
	in_stock: z.boolean(),
	stock: z.number(),
	synced_at: z.string().nullable()
})

export const adminVariantsListSchema = z.object({
	items: z.array(adminVariantSchema),
	total: z.number(),
	page: z.number(),
	limit: z.number()
})

export type AdminVariant = z.infer<typeof adminVariantSchema>
export type AdminVariantsList = z.infer<typeof adminVariantsListSchema>

export interface AdminVariantsQuery {
	q?: string
	page?: number
	limit?: number
}
