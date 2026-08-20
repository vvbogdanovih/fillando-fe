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
