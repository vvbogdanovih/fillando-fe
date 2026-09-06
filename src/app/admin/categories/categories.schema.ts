import '@/common/lib/zod-locale'
import * as z from 'zod'

// --- Response schemas (include server-computed fields) ---

export const requiredAttributeSchema = z.object({
	key: z.string(),
	label: z.string(),
	filter_type: z.enum(['multi-select', 'range']),
	unit: z.string().nullable()
})

/** Google product taxonomy node used as `g:google_product_category` in the Merchant feed. */
export const googleProductCategorySchema = z.object({
	id: z.number().int().positive(),
	path: z.string()
})

export const categorySchema = z.object({
	_id: z.string(),
	name: z.string(),
	slug: z.string(),
	image: z.string().nullable(),
	order: z.number().default(0),
	required_attributes: z.array(requiredAttributeSchema).default([]),
	// Optional so an older backend response still validates.
	google_product_category: googleProductCategorySchema.nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string()
})

export const categoriesListSchema = z.array(categorySchema)

// --- Form schemas (no attr_id, no server fields) ---

export const attributeFormSchema = z.object({
	label: z.string().min(1, "Label є обов'язковим"),
	filter_type: z.enum(['multi-select', 'range']),
	unit: z.string().nullable()
})

export const categoryFormSchema = z.object({
	name: z.string().min(1, "Назва є обов'язковою"),
	slug: z.string().min(1, "Slug є обов'язковим"),
	order: z.number().int().min(0).optional(),
	required_attributes: z.array(attributeFormSchema),
	// Two plain inputs; the payload assembles `{ id, path }` or null from them.
	google_product_category_id: z
		.string()
		.optional()
		.refine(v => !v || /^\d+$/.test(v.trim()), 'ID — ціле число з таксономії Google'),
	google_product_category_path: z.string().optional()
})

/** What the API accepts on create/update — the form values with the taxonomy node assembled. */
export type CategoryPayload = {
	name: string
	slug: string
	order?: number
	required_attributes: z.infer<typeof attributeFormSchema>[]
	google_product_category?: z.infer<typeof googleProductCategorySchema> | null
}

// --- Types ---

export type Category = z.infer<typeof categorySchema>
export type GoogleProductCategory = z.infer<typeof googleProductCategorySchema>
export type RequiredAttribute = z.infer<typeof requiredAttributeSchema>
export type CategoryFormValues = z.infer<typeof categoryFormSchema>
export type AttributeFormValues = z.infer<typeof attributeFormSchema>
