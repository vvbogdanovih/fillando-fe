import '@/common/lib/zod-locale'
import * as z from 'zod'

// --- Attribute item ---

export const attributeItemSchema = z.object({
	k: z.string(), // attribute key — toAttrKey(label) in the forms, generateAttrKey server-side
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
	vendor_product_sku: z.string().optional(),
	prom_id: z.string().optional(),
	// Dictionary colour. `color_family` is never sent — the API derives it (TD-0002 §5.2.2).
	color_id: z.string().nullable().optional(),
	// Shipping weight in grams, kept as a string like price/stock; '' means "unknown" → null.
	weight_g: z
		.string()
		.optional()
		.refine(
			v => !v || (Number.isInteger(Number(v)) && Number(v) >= 0),
			'Вага — ціле число грамів'
		)
})

// --- Main product form schema (create) ---

export const productFormSchema = z
	.object({
		name: z.string().min(1, "Назва продукту є обов'язковою"),
		vendor_id: z.string().min(1, 'Оберіть вендора'),
		category_id: z.string().min(1, 'Оберіть категорію'),
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
	vendor_product_sku: z.string().optional(),
	prom_id: z.string().optional(),
	color_id: z.string().nullable().optional(),
	// Shipping weight in grams, kept as a string like price/stock; '' means "unknown" → null.
	weight_g: z
		.string()
		.optional()
		.refine(
			v => !v || (Number.isInteger(Number(v)) && Number(v) >= 0),
			'Вага — ціле число грамів'
		),
	// Promotion (TD-0012): strings like the other numbers; '' means "no promotion" → null.
	promo_percent: z
		.string()
		.optional()
		.refine(
			v => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 90),
			'Відсоток акції — ціле число від 1 до 90'
		),
	promo_ends_at: z
		.string()
		.optional()
		.refine(v => !v || !Number.isNaN(new Date(v).getTime()), 'Вкажіть коректну дату')
})

// --- API response schemas ---

export const productVariantResponseSchema = z.object({
	_id: z.string(),
	color_id: z.string().nullable().optional(),
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
	category_id: z.string(),
	name: z.string(),
	slug: z.string(),
	sku: z.string(),
	price: z.number(),
	stock: z.number(),
	images: z.array(z.string()),
	v_value: z.string().nullable(),
	vendor_product_sku: z.string().optional(),
	prom_id: z.string().optional(),
	status: z.enum(['draft', 'active', 'archived']),
	// Optional so an older backend response still validates; the picker seeds from it.
	color_id: z.string().nullable().optional(),
	// Shipping weight in grams (TD-0006); optional for the same reason.
	weight_g: z.number().nullable().optional(),
	// Promotion (TD-0012) and what the shop pays — admin-only, for the below-cost warning.
	promo_percent: z.number().nullable().optional(),
	promo_ends_at: z.string().nullable().optional(),
	supplier_price: z.number().nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string()
})

/** `PATCH /products/:id/promotion` — one promotion for every variant, or none. */
export type PromotionPayload =
	| { promo_percent: number; promo_ends_at: string | null }
	| { promo_percent: null }

/** The admin's preview of the sale price — the same half-up whole-hryvnia rounding the backend uses. */
export const previewSalePrice = (price: number, percent: number): number =>
	Math.floor(price * (1 - percent / 100) + 0.5)

/**
 * What the stored promo fields mean right now. The backend keeps them on the document after the
 * end date (the storefront simply derives «no promo»), so the admin must read them the same way
 * or it would announce a sale the shop no longer gives. The same goes for a percent that rounds
 * to no saving (1 % off 40 ₴ is still 40 ₴) or to nothing at all (90 % off 3 ₴): the backend
 * derives no promotion there, so the table must not show a strike-through either.
 */
export type PromoState = 'none' | 'live' | 'ended'
export const promoStateOf = (
	variant: { price: number; promo_percent?: number | null; promo_ends_at?: string | null },
	now: number = Date.now()
): PromoState => {
	if (variant.promo_percent == null) return 'none'
	const sale = previewSalePrice(variant.price, variant.promo_percent)
	if (!(sale > 0 && sale < variant.price)) return 'none'
	if (variant.promo_ends_at && Date.parse(variant.promo_ends_at) <= now) return 'ended'
	return 'live'
}

export const productVariantsListResponseSchema = z.array(productVariantFullResponseSchema)

export const promotionResponseSchema = z.object({
	matched: z.number(),
	modified: z.number(),
	variants: productVariantsListResponseSchema
})
export type PromotionResponse = z.infer<typeof promotionResponseSchema>

export const productResponseSchema = z.object({
	_id: z.string(),
	name: z.string(),
	vendor_id: z.string().optional(),
	category_id: z.string(),
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

export type PageOrientation = 'portrait' | 'landscape'

/** Request body for POST /products/price-list/pdf (no response schema — it is a blob). */
export interface PriceListPayload {
	category_ids?: string[]
	in_stock_only?: boolean
	tier1_percent?: number
	tier2_percent?: number
	orientation?: PageOrientation
}
