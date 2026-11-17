import '@/common/lib/zod-locale'
import * as z from 'zod'

const googleCategorySchema = z
	.object({ id: z.number().int().positive(), path: z.string() })
	.nullable()
export const categoryExportReadSchema = z.object({
	category_id: z.string(),
	revision: z.number().int().nonnegative(),
	name: z.string(),
	status: z.enum(['draft', 'active']),
	google_product_category: googleCategorySchema
})
export type CategoryExportRead = z.infer<typeof categoryExportReadSchema>
export const categoryExportBodySchema = z.object({
	expected_revision: z.number().int().nonnegative().safe(),
	google_product_category: googleCategorySchema
})
export type CategoryExportBody = z.infer<typeof categoryExportBodySchema>
