import { toAttrKey } from '@/common/utils'
import type { PageOrientation, PriceListPayload } from './products.schema'

export interface PriceListFormState {
	categoryIds: string[]
	allCategories: boolean
	inStockOnly: boolean
	tier1Percent: string
	tier2Percent: string
	orientation: PageOrientation
}

export const buildPriceListPayload = (state: PriceListFormState): PriceListPayload => {
	const payload: PriceListPayload = {
		in_stock_only: state.inStockOnly,
		tier1_percent: Number(state.tier1Percent),
		tier2_percent: Number(state.tier2Percent),
		orientation: state.orientation
	}
	// "All categories" omits the key rather than listing every id: the payload stays small
	// and stays correct if a category was created after this page cached ['categories'].
	if (!state.allCategories) payload.category_ids = state.categoryIds
	return payload
}

export const parseAttachmentFilename = (header: string | undefined, fallback: string): string => {
	if (!header) return fallback
	// RFC 5987 form, in case the backend ever sends a non-ASCII filename.
	const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
	if (utf8?.[1]) {
		try {
			return decodeURIComponent(utf8[1])
		} catch {
			return fallback
		}
	}
	return header.match(/filename="?([^";]+)"?/)?.[1] ?? fallback
}

// --- Attribute rows in the product form ---

export interface AttributeField {
	k: string
	l: string
	v: string | number | boolean
}

export interface RequiredAttributeLike {
	key: string
	label: string
	unit?: string | null
}

export interface AttributeRow {
	attr: RequiredAttributeLike
	/** Index in the field array, or `null` when the product has no such attribute yet. */
	index: number | null
	value: string
	/**
	 * Further rows carrying the same key. A multi-valued dimension is stored as several
	 * attribute entries (`reinforcement: CF` and `reinforcement: GF`; `finish: Matte` and
	 * `finish: Rainbow`) — that is what `$elemMatch` filters on — and each of them must be
	 * visible and removable, or an admin sees «Matte», never «Rainbow», and cannot fix it.
	 */
	extra: { field: AttributeField; index: number }[]
}

export interface AttributeLayout {
	required: AttributeRow[]
	custom: { field: AttributeField; index: number }[]
}

/**
 * Pairs a category's required attributes with the product's own attribute rows **by key**.
 *
 * This used to be done by position — `fields[i]` was assumed to hold `requiredAttrs[i]` — which
 * holds only immediately after a re-seed. On the edit screen the array comes from the product in
 * stored order and the re-seed is deliberately skipped on mount, so the moment a category gains
 * or loses a required attribute the two lists slide apart: typing in one input then overwrote a
 * different attribute wholesale, and `fields.length > requiredCount` went false, hiding every
 * custom attribute.
 *
 * That is not hypothetical. Plan-0004 task 17 replaces `material` with four new dimensions on
 * the filament category, so every existing product's stored order stops matching the category's
 * list the moment that migration runs.
 *
 * Matching on the key that `toAttrKey(label)` produces — the same key the API derives — makes
 * the pairing independent of order and of how many attributes each side has.
 */
export function layoutAttributes(
	requiredAttrs: RequiredAttributeLike[],
	fields: AttributeField[]
): AttributeLayout {
	const requiredKeys = new Set(requiredAttrs.map(attr => toAttrKey(attr.label)))

	const required = requiredAttrs.map(attr => {
		const key = toAttrKey(attr.label)
		const matches = fields
			.map((field, index) => ({ field, index }))
			.filter(({ field }) => field.k === key)
		const first = matches[0]
		return {
			attr,
			index: first ? first.index : null,
			value: first ? String(first.field.v ?? '') : '',
			extra: matches.slice(1)
		}
	})

	const custom = fields
		.map((field, index) => ({ field, index }))
		.filter(({ field }) => !requiredKeys.has(field.k))

	return { required, custom }
}
