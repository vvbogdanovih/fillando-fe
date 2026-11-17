import '@/common/lib/zod-locale'
import * as z from 'zod'
import { savedDefinitionSchema } from './category-definitions.schema'
const id = z.string().regex(/^[a-f0-9]{24}$/)
const scalar = z.union([z.string().min(1).max(2000), z.number(), z.boolean()])
/**
 * Supplier identifiers, as the old admin's «Артикул вендора» / «ID на Промі». Optional and
 * nullable both ways: an older backend omits them, and an omitted field leaves the stored value.
 * `prom_id` is what the Prom price/stock sync keys on.
 */
const supplierId = z.string().trim().max(100).nullable().optional()
/** Form text → request value: blank clears the field. */
export const supplierIdInput = (text: string) => text.trim() || null
/**
 * The product's own warning above «В кошик», `badge` over the photo — on this product only
 * (owner, 2026-11-05: product data lives in the product, never in its category). Plain text.
 */
export const purchaseNoticeSchema = z.strictObject({
	title: z.string().trim().min(1).max(120),
	text: z.string().trim().min(1).max(1000),
	badge: z.string().trim().max(40).nullable()
})
export type PurchaseNotice = z.infer<typeof purchaseNoticeSchema>
/**
 * The notice form → what a details save sends: all three blank is no notice (`null`); a title
 * needs its text and the other way round; the photo text only rides with them.
 */
export function purchaseNoticeInput(fields: {
	title: string
	text: string
	badge: string
}): PurchaseNotice | null {
	const title = fields.title.trim(),
		text = fields.text.trim(),
		badge = fields.badge.trim()
	if (!title && !text && !badge) return null
	if (!title !== !text)
		throw Error('Заповніть і заголовок, і текст попередження — або залиште обидва порожніми.')
	if (!title) throw Error('Напис на фото показується лише разом із заголовком і текстом.')
	return { title, text, badge: badge || null }
}
/**
 * A SKU's photos: public http(s) addresses in display order (the first is the main one), at most
 * 30 — the backend's rule, for a details save and for creation alike.
 */
const imagesSchema = z
	.array(
		z
			.string()
			.max(2048)
			.url()
			.refine(value => /^https?:\/\//.test(value))
	)
	.max(30)
/** The product's description as the editor writes it; `null` — none. */
const descriptionSchema = z
	.strictObject({
		html: z.string().max(100000),
		json: z
			.record(z.string(), z.unknown())
			.refine(value => JSON.stringify(value).length <= 100000)
	})
	.nullable()
/** Parcel weight in grams; `null` — unknown (a readiness warning, never an issue). */
const weightSchema = z.number().int().positive().max(1000000000).nullable()
export const productDetailsSchema = z.strictObject({
	token: z.string().regex(/^[a-f0-9]{64}$/),
	description: descriptionSchema,
	variants: z
		.array(
			z.strictObject({
				id: z.string().regex(/^[a-f0-9]{24}$/),
				price: z.number().nonnegative().max(1000000000),
				stock: z.number().int().nonnegative().safe(),
				weight_g: weightSchema,
				vendor_product_sku: supplierId,
				prom_id: supplierId,
				/**
				 * The SKU's promotion (TD-0012). Omitted keeps the stored one (an untouched row
				 * never resends an ended promotion's past date); null clears percent and date.
				 */
				promo_percent: z.number().int().min(1).max(90).nullable().optional(),
				promo_ends_at: z.string().nullable().optional(),
				images: imagesSchema
			})
		)
		.min(1)
		.max(100),
	/** Read: the stored notice (absent from an older backend). Save: omitted keeps it, null clears. */
	purchase_notice: purchaseNoticeSchema.nullable().optional()
})
export const variantActionSchema = z.discriminatedUnion('type', [
	z.strictObject({
		type: z.literal('add'),
		variant_value: scalar,
		price: z.number().nonnegative().max(1000000000),
		stock: z.number().int().nonnegative().safe(),
		weight_g: weightSchema,
		/** Omitted is a draft; active only for a complete product (`PRODUCT_NOT_READY`). */
		status: z.enum(['draft', 'active']).optional(),
		vendor_product_sku: supplierId,
		prom_id: supplierId,
		/** Photos picked in the window, uploaded before the command; omitted — none. */
		images: imagesSchema.optional()
	}),
	z.strictObject({ type: z.literal('archive'), id: z.string().regex(/^[a-f0-9]{24}$/) }),
	/** Every draft/active SKU → archived in one save. */
	z.strictObject({ type: z.literal('archive_all') }),
	/** Remove a never-sold draft/archived SKU (the product keeps one). */
	z.strictObject({ type: z.literal('delete'), id: z.string().regex(/^[a-f0-9]{24}$/) }),
	z.strictObject({ type: z.literal('restore'), id: z.string().regex(/^[a-f0-9]{24}$/) }),
	z.strictObject({
		type: z.literal('status'),
		id: z.string().regex(/^[a-f0-9]{24}$/),
		status: z.enum(['draft', 'active', 'archived'])
	})
])
export const typedProductBodySchema = z.strictObject({
	expected_revision: z.number().int().nonnegative().safe(),
	/** The supplier; omitted keeps it (old admin's «Постачальник»). */
	vendor_id: id.optional(),
	details: productDetailsSchema.optional(),
	variant_action: variantActionSchema.optional(),
	name: z.string().trim().min(1).max(200),
	attributes_v2: z.array(z.strictObject({ k: z.string().min(1).max(100), v: scalar })).max(1000),
	variant_axis: z.strictObject({ key: z.string().min(1).max(100) }).nullable(),
	variants: z
		.array(z.strictObject({ id, variant_value: scalar.nullable() }))
		.min(1)
		.max(100)
})
export const typedProductReadSchema = typedProductBodySchema
	.omit({ expected_revision: true })
	.extend({
		readiness: z
			.object({
				data_ready: z.boolean(),
				issues: z.array(
					z.object({ code: z.string(), field: z.string(), variant_id: id.optional() })
				),
				warnings: z.array(
					z.object({ code: z.string(), field: z.string(), variant_id: id.optional() })
				)
			})
			.optional(),
		product_id: id,
		category_id: id,
		vendor_id: id.nullable().optional(),
		/** Published category: edits are live at once. Absent from an older backend. */
		published: z.boolean().optional(),
		/** The axis holds dictionary colour ids. */
		color_axis: z.boolean().optional(),
		revision: z.number().int().nonnegative(),
		definitions: z.array(savedDefinitionSchema),
		variants: z
			.array(
				z.object({
					id,
					variant_value: scalar.nullable(),
					name: z.string(),
					slug: z.string(),
					sku: z.string(),
					status: z.enum(['draft', 'active', 'archived']).optional(),
					/** What the shop pays (below-cost warning for a promotion). */
					supplier_price: z.number().nullable().optional()
				})
			)
			.min(1)
			.max(100)
	})
export const typedProductPageSchema = z.object({
	category_id: id,
	revision: z.number().int().nonnegative(),
	items: z.array(z.object({ id, name: z.string() })).max(25),
	/** Products of the category matching `q` (all without it) — the pager's page count. */
	total: z.number().int().nonnegative(),
	next_cursor: z.string().nullable()
})
export const typedProductReceiptSchema = z.object({
	operation_id: z.string().uuid(),
	revision: z.number().int().nonnegative(),
	product_id: id
})
export type TypedProduct = z.infer<typeof typedProductReadSchema>
export type TypedProductBody = z.infer<typeof typedProductBodySchema>
export type TypedDefinition = z.infer<typeof savedDefinitionSchema>
/** Form conversion is explicit; the API never coerces values. Empty input means missing. */
export function parseField(
	definition: TypedDefinition,
	text: string
): string | number | boolean | null {
	if (text === '') return null
	if (definition.value_type === 'number') {
		if (!text.trim() || !Number.isFinite(Number(text)))
			throw Error(`Перевірте число: ${definition.label}`)
		return Number(text)
	}
	if (definition.value_type === 'boolean') {
		if (!['true', 'false'].includes(text))
			throw Error(`Перевірте значення: ${definition.label}`)
		return text === 'true'
	}
	if (definition.value_type === 'enum' && !definition.options.some(option => option.id === text))
		throw Error(`Оберіть значення: ${definition.label}`)
	if (!text.trim()) throw Error(`Заповніть значення: ${definition.label}`)
	return text
}

export const typedProductCreateBodySchema = typedProductBodySchema
	.omit({ variants: true, details: true, variant_action: true })
	.extend({
		category_id: id,
		vendor_id: id,
		/** «Усе одразу» (owner, 2026-11-15): what the edit screen has, sent with the creation. */
		description: descriptionSchema.optional(),
		purchase_notice: purchaseNoticeSchema.nullable().optional(),
		variants: z
			.array(
				z.strictObject({
					variant_value: scalar.nullable(),
					price: z.number().nonnegative().max(1_000_000_000),
					stock: z.number().int().nonnegative().safe(),
					weight_g: weightSchema.optional(),
					/** Omitted is a draft; active only for a complete product. */
					status: z.enum(['draft', 'active']).optional(),
					vendor_product_sku: supplierId,
					prom_id: supplierId,
					/** Photos picked in the creation form, uploaded before the command; omitted — none. */
					images: imagesSchema.optional()
				})
			)
			.min(1)
			.max(100)
	})
export type TypedProductCreateBody = z.infer<typeof typedProductCreateBodySchema>

/** Moving a product to another category (Plan-0010 F04): body in the target's terms. */
export const typedProductTransferBodySchema = z.strictObject({
	expected_revision: z.number().int().nonnegative().safe(),
	target_category_id: id,
	attributes_v2: z.array(z.strictObject({ k: z.string().min(1).max(200), v: scalar })).max(200),
	variant_axis: z.strictObject({ key: z.string().min(1).max(200) }).nullable(),
	variants: z
		.array(z.strictObject({ id, variant_value: scalar.nullable() }))
		.min(1)
		.max(100),
	confirm_dropped: z.array(z.string().min(1).max(200)).max(200)
})
export type TypedProductTransferBody = z.infer<typeof typedProductTransferBodySchema>
const transferCategorySchema = z.object({ id, name: z.string(), status: z.string() })
export const transferPreviewSchema = z.object({
	revision: z.number().int().nonnegative(),
	product_id: id,
	name: z.string(),
	source: transferCategorySchema,
	target: transferCategorySchema.extend({ definitions: z.array(savedDefinitionSchema) }),
	mapped: z.array(
		z.object({
			source_key: z.string(),
			target_key: z.string(),
			target_label: z.string(),
			value: scalar
		})
	),
	dropped: z.array(
		z.object({
			key: z.string(),
			label: z.string(),
			value: scalar,
			value_label: z.string(),
			reason: z.enum(['no_target', 'type', 'multiple', 'axis'])
		})
	),
	missing_required: z.array(z.string()),
	axis_problem: z.enum(['AXIS_NO_TARGET', 'AXIS_TYPE', 'AXIS_VALUES']).nullable(),
	variants_to_draft: z.number().int().nonnegative(),
	proposal: z.object({
		attributes_v2: z.array(z.object({ k: z.string(), v: scalar })),
		variant_axis: z.object({ key: z.string() }).nullable(),
		variants: z.array(z.object({ id, variant_value: scalar.nullable() }))
	})
})
export type TransferPreview = z.infer<typeof transferPreviewSchema>
export const typedProductTransferReceiptSchema = typedProductReceiptSchema.extend({
	category_id: id
})
