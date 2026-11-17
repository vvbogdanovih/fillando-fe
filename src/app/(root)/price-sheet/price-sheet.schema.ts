import '@/common/lib/zod-locale'
import * as z from 'zod'

export const adminVariantSchema = z.object({
	id: z.string(),
	slug: z.string(),
	image: z.string().nullable(),
	name: z.string(),
	// The row's section and its text per column of that category (owner, 2026-11-06); absent
	// from an older backend, which answers one flat list.
	category_id: z.string().optional(),
	values: z.record(z.string(), z.string()).optional(),
	manufacturer: z.string().nullable(),
	// Deprecated by the backend; not shown.
	material: z.string().nullable().optional(),
	color: z.string().nullable(),
	variant_label: z.string().nullable().optional(),
	article: z.string().nullable(),
	price: z.number(),
	// The shop's own promotion (TD-0012); null — or absent from an older backend — without one.
	sale_price: z.number().nullable().optional(),
	promo_percent: z.number().nullable().optional(),
	promo_ends_at: z.string().nullable().optional(),
	in_stock: z.boolean(),
	stock: z.number(),
	synced_at: z.string().nullable()
})

/** A category of the page: its columns are the characteristics the catalogue filters it by. */
export const priceSheetCategorySchema = z.object({
	id: z.string(),
	name: z.string(),
	columns: z.array(z.object({ key: z.string(), label: z.string() })),
	// A variation no column shows (v1, an axis that is not a filter): keep «Варіант».
	variant_column: z.boolean()
})

export const adminVariantsListSchema = z.object({
	items: z.array(adminVariantSchema),
	categories: z.array(priceSheetCategorySchema).optional(),
	total: z.number(),
	page: z.number(),
	limit: z.number()
})

export type AdminVariant = z.infer<typeof adminVariantSchema>
export type PriceSheetCategory = z.infer<typeof priceSheetCategorySchema>
export type AdminVariantsList = z.infer<typeof adminVariantsListSchema>

export interface AdminVariantsQuery {
	q?: string
	page?: number
	limit?: number
}
