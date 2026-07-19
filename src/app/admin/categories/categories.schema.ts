import { z } from 'zod'

// --- Response schemas (include server-computed fields) ---

export const requiredAttributeSchema = z.object({
	key: z.string(),
	label: z.string(),
	filter_type: z.enum(['multi-select', 'range']),
	unit: z.string().nullable()
})

export const categorySchema = z.object({
	_id: z.string(),
	name: z.string(),
	slug: z.string(),
	image: z.string().nullable(),
	order: z.number().default(0),
	required_attributes: z.array(requiredAttributeSchema).default([]),
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
	required_attributes: z.array(attributeFormSchema)
})

// --- Types ---

export type Category = z.infer<typeof categorySchema>
export type RequiredAttribute = z.infer<typeof requiredAttributeSchema>
export type CategoryFormValues = z.infer<typeof categoryFormSchema>
export type AttributeFormValues = z.infer<typeof attributeFormSchema>
