import '@/common/lib/zod-locale'
import * as z from 'zod'

/** Mirrors `FeedGenerationSummary` / `FeedStatus` in fillando-be `src/modules/feed/feed.types.ts`. */

export const feedExclusionReasonSchema = z.enum([
	'missing_brand',
	'no_images',
	'no_price',
	'dangling_product',
	'dangling_category'
])

export const feedWarningCodeSchema = z.enum([
	'no_google_product_category',
	'no_description',
	'no_weight',
	'missing_required_attribute'
])

export const feedSummarySchema = z.object({
	generated_at: z.string(),
	duration_ms: z.number(),
	item_count: z.number(),
	in_stock: z.number(),
	out_of_stock: z.number(),
	typed_by_landing: z.number(),
	excluded: z.array(
		z.object({ sku: z.string(), name: z.string(), reason: feedExclusionReasonSchema })
	),
	warnings: z.array(
		z.object({
			code: feedWarningCodeSchema,
			count: z.number(),
			skus: z.array(z.string()),
			detail: z.record(z.string(), z.number()).optional()
		})
	)
})

export const feedStatusSchema = z.object({
	xml_ready: z.boolean(),
	generating: z.boolean(),
	scheduled: z.boolean(),
	feed_path: z.string(),
	last_error: z.string().nullable(),
	summary: feedSummarySchema.nullable()
})

export type FeedSummary = z.infer<typeof feedSummarySchema>
export type FeedStatus = z.infer<typeof feedStatusSchema>
export type FeedExclusionReason = z.infer<typeof feedExclusionReasonSchema>
export type FeedWarningCode = z.infer<typeof feedWarningCodeSchema>

/** What the admin reads instead of the code. Reasons remove the item; warnings only weaken it. */
export const EXCLUSION_LABELS: Record<FeedExclusionReason, string> = {
	missing_brand: 'Немає атрибута «Виробник» — Google вимагає бренд',
	no_images: 'Немає жодного фото',
	no_price: 'Ціна відсутня або нуль',
	dangling_product: 'Товар варіанта не знайдено',
	dangling_category: 'Категорію варіанта не знайдено'
}

export const WARNING_COPY: Record<FeedWarningCode, { title: string; text: string }> = {
	no_weight: {
		title: 'Не заповнена вага',
		text: 'У фіді немає shipping_weight — Merchant не порахує доставку за вагою'
	},
	no_description: {
		title: 'Порожній опис',
		text: 'У фід іде назва замість опису — слабший сигнал релевантності'
	},
	missing_required_attribute: {
		title: "Не заповнений обов'язковий атрибут категорії",
		text: 'Фільтр і product_type для цих товарів неповні'
	},
	no_google_product_category: {
		title: 'Категорія без Google-таксономії',
		text: 'Не задано google_product_category — заповніть його у формі категорії'
	}
}
