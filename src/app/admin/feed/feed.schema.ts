import '@/common/lib/zod-locale'
import * as z from 'zod'
import { pluralUk, productsCount } from '@/common/utils'

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

/** What a warning's `count` counts — one untagged category is one problem, not forty items. */
export const feedWarningUnitSchema = z.enum(['item', 'category'])

/** Why a generation published nothing. `empty_feed`: zero items, so the cache was left alone. */
export const feedFailureReasonSchema = z.enum(['empty_feed'])

/** One unfulfilled required attribute with the label the admin form prints («Діаметр»). */
export const feedRequiredAttributeGapSchema = z.object({
	key: z.string(),
	label: z.string(),
	count: z.number()
})

export const feedWarningSchema = z.object({
	code: feedWarningCodeSchema,
	/** Affected entities, counted in `unit` — never read one without the other. */
	count: z.number(),
	unit: feedWarningUnitSchema,
	/** Feed rows carrying this warning, whatever `unit` counts. */
	item_count: z.number(),
	skus: z.array(z.string()),
	detail: z.record(z.string(), z.number()).optional(),
	attributes: z.array(feedRequiredAttributeGapSchema).optional()
})

export const feedSummarySchema = z.object({
	/** False when the run published nothing — check it before reading any count below. */
	ok: z.boolean(),
	failure_reason: feedFailureReasonSchema.nullable(),
	error: z.string().nullable(),
	generated_at: z.string(),
	duration_ms: z.number(),
	item_count: z.number(),
	in_stock: z.number(),
	out_of_stock: z.number(),
	typed_by_landing: z.number(),
	excluded: z.array(
		z.object({ sku: z.string(), name: z.string(), reason: feedExclusionReasonSchema })
	),
	warnings: z.array(feedWarningSchema),
	/** Distinct warning kinds — the KPI counts kinds, not the positions behind them. */
	warning_kinds: z.number(),
	/** Feed rows carrying at least one warning, counted once however many they carry. */
	warned_items: z.number()
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
export type FeedWarning = z.infer<typeof feedWarningSchema>
export type FeedWarningUnit = z.infer<typeof feedWarningUnitSchema>
export type FeedFailureReason = z.infer<typeof feedFailureReasonSchema>

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

/** A 2xx answer with `ok: false` is a refused publish, so it needs its own sentence. */
export const FAILURE_COPY: Record<FeedFailureReason, string> = {
	empty_feed: 'Генерація не дала жодного товару — попередній XML залишено без змін'
}

/**
 * «3 товари» / «1 категорія» — the noun comes from the warning's own `unit` and the form from the
 * Ukrainian plural rules. Choosing both by the warning code printed «3 товарів» (Plan-0005 I-12).
 */
export const warningCountLabel = (count: number, unit: FeedWarningUnit): string =>
	unit === 'category'
		? `${count} ${pluralUk(count, 'категорія', 'категорії', 'категорій')}`
		: productsCount(count)
