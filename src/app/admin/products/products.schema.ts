import { z } from 'zod'

// --- Attribute item ---

export const attributeItemSchema = z.object({
	k: z.string(), // slug key, generated via toSlug(label)
	l: z.string().min(1, "Назва атрибута є обов'язковою"),
	v: z.union([z.string(), z.number(), z.boolean()])
})

// --- Variant item (form) ---

export const variantFormItemSchema = z.object({
	v_value: z.string().nullable(),
	sku: z.string().optional(),
	price: z
		.string()
		.min(1, "Ціна є обов'язковою")
		.refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Введіть коректну ціну'),
	stock: z
		.string()
		.min(1, "Кількість є обов'язковою")
		.refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Введіть коректну кількість'),
	images: z.array(z.string()), // public URLs, populated after upload
	vendor_product_sku: z.string().optional()
})

// --- Main product form schema (create) ---

export const productFormSchema = z
	.object({
		name: z.string().min(1, "Назва продукту є обов'язковою"),
		vendor_id: z.string().min(1, 'Оберіть вендора'),
		category_id: z.string().min(1, 'Оберіть категорію'),
		subcategory_id: z.string().min(1, 'Оберіть підкатегорію'),
		attributes: z.array(attributeItemSchema),
		has_variants: z.boolean(),
		variant_type_key: z.string().nullable(),
		variants: z.array(variantFormItemSchema).min(1)
	})
	.superRefine((data, ctx) => {
		if (data.has_variants) {
			if (!data.variant_type_key) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['variant_type_key'],
					message: 'Оберіть ознаку варіативності'
				})
			}
			data.variants.forEach((v, i) => {
				if (!v.v_value || v.v_value.trim() === '') {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['variants', i, 'v_value'],
						message: "Значення варіанта є обов'язковим"
					})
				}
			})
		}
	})

// --- Product edit form schema ---

export const productEditFormSchema = z.object({
	name: z.string().min(1, "Назва продукту є обов'язковою"),
	vendor_id: z.string().min(1, 'Оберіть вендора'),
	category_id: z.string().min(1, 'Оберіть категорію'),
	subcategory_id: z.string().min(1, 'Оберіть підкатегорію'),
	attributes: z.array(attributeItemSchema),
	variant_type_key: z.string().nullable()
})

// --- Variant add/edit form schema ---

export const variantEditFormSchema = z.object({
	v_value: z.string().nullable(),
	price: z
		.string()
		.min(1, "Ціна є обов'язковою")
		.refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Введіть коректну ціну'),
	stock: z
		.string()
		.min(1, "Кількість є обов'язковою")
		.refine(v => !isNaN(Number(v)) && Number(v) >= 0, 'Введіть коректну кількість'),
	status: z.enum(['draft', 'active', 'archived']),
	vendor_product_sku: z.string().optional()
})

// --- API response schemas ---

export const productVariantResponseSchema = z.object({
	_id: z.string(),
	v_value: z.string().nullable(),
	sku: z.string(),
	price: z.number(),
	stock: z.number(),
	images: z.array(z.string())
})

// Full variant response — returned by GET /products/:id/variants
export const productVariantFullResponseSchema = z.object({
	_id: z.string(),
	product_id: z.string(),
	subcategory_id: z.string(),
	name: z.string(),
	slug: z.string(),
	sku: z.string(),
	price: z.number(),
	stock: z.number(),
	images: z.array(z.string()),
	v_value: z.string().nullable(),
	vendor_product_sku: z.string().optional(),
	status: z.enum(['draft', 'active', 'archived']),
	createdAt: z.string(),
	updatedAt: z.string()
})

export const productVariantsListResponseSchema = z.array(productVariantFullResponseSchema)

export const productResponseSchema = z.object({
	_id: z.string(),
	name: z.string(),
	vendor_id: z.string().optional(),
	category_id: z.string(),
	subcategory_id: z.string(),
	description: z
		.object({
			json: z.record(z.string(), z.unknown()),
			html: z.string()
		})
		.nullish(),
	attributes: z.array(attributeItemSchema),
	variant_type: z
		.object({
			key: z.string(),
			label: z.string()
		})
		.nullish(),
	variants: z.array(productVariantResponseSchema),
	createdAt: z.string(),
	updatedAt: z.string()
})

// Product detail — returned by GET /products/:id (no variants)
export const productDetailSchema = z.object({
	_id: z.string(),
	name: z.string(),
	vendor_id: z.string(),
	category_id: z.string(),
	subcategory_id: z.string(),
	description: z
		.object({
			json: z.record(z.string(), z.unknown()),
			html: z.string()
		})
		.nullish(),
	attributes: z.array(attributeItemSchema),
	variant_type: z
		.object({
			key: z.string(),
			label: z.string()
		})
		.nullish(),
	createdAt: z.string(),
	updatedAt: z.string()
})

// Product list item — returned by GET /products
export const productListItemSchema = z.object({
	_id: z.string(),
	name: z.string(),
	vendor_id: z.string().optional(),
	category_id: z.string(),
	subcategory_id: z.string(),
	attributes: z.array(attributeItemSchema),
	variant_type: z
		.object({
			key: z.string(),
			label: z.string()
		})
		.nullish(),
	createdAt: z.string(),
	updatedAt: z.string()
})

export const validateResponseSchema = z.object({
	slugs: z.array(z.string()), // slugs that are already taken
	skus: z.array(z.string()) // skus that are already taken
})

// --- Types ---

export type AttributeItem = z.infer<typeof attributeItemSchema>
export type VariantFormItem = z.infer<typeof variantFormItemSchema>
export type ProductFormValues = z.infer<typeof productFormSchema>
export type ProductEditFormValues = z.infer<typeof productEditFormSchema>
export type VariantEditFormValues = z.infer<typeof variantEditFormSchema>
export type Product = z.infer<typeof productResponseSchema>
export type ProductDetail = z.infer<typeof productDetailSchema>
export type ProductListItem = z.infer<typeof productListItemSchema>
export type ProductVariant = z.infer<typeof productVariantResponseSchema>
export type ProductVariantFull = z.infer<typeof productVariantFullResponseSchema>
export type ValidateResponse = z.infer<typeof validateResponseSchema>
