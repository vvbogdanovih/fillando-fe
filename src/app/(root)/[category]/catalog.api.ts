import { httpService } from '@/common/services/http.service'
import type { PublicColor } from '@/common/utils/color.utils'
import { API_URLS } from '@/common/constants'
import { categorySchema, type Category } from '@/app/admin/categories/categories.schema'

export interface CatalogItem {
	id: string
	name: string
	slug: string
	sku: string
	price: number
	/** When `price` was last confirmed against the vendor. Shown for out-of-stock items. */
	price_updated_at: string | null
	stock: number
	quantity?: number
	v_value: string | null
	attributes: { k: string; l: string; v: string | number | boolean }[]
	main_image: string | null
	color: PublicColor | null
}

export interface ProductDetailData {
	variant: {
		id: string
		name: string
		slug: string
		sku: string
		price: number
		price_updated_at: string | null
		stock: number
		quantity?: number
		images: string[]
		v_value: string | null
		/** `archived` renders as «Знято з продажу»; a draft never reaches the storefront (404). */
		status: 'draft' | 'active' | 'archived'
		/** Resolved dictionary colour; null for categories with no colour axis. */
		color: PublicColor | null
		/** Shipping weight in grams (filament + spool); null until set. Drives the delivery estimate. */
		weight_g: number | null
	}
	product: {
		id: string
		name: string
		description: { html: string; json: any } | null
		attributes: { k: string; l: string; v: string | number | boolean }[]
		variant_type: { key: string; label: string } | null
		/** The «Виробник» attribute — the brand. Never the vendor, which is the supplier. */
		manufacturer: string | null
	}
	siblings: {
		id: string
		name: string
		slug: string
		price: number
		price_updated_at: string | null
		stock: number
		v_value: string | null
		images: string[]
		color: PublicColor | null
	}[]
	category_slug: string
	category_name: string
	/**
	 * Set only on a refill: the spooled version of the same filament. After
	 * `split-refill-products.js` the two are separate products with no siblings in common, so
	 * this is the only thing that connects them.
	 */
	spooled_counterpart?: {
		slug: string
		name: string
		price: number
		/** false when it is the cheapest spool rather than this refill's own colour. */
		matched_colour: boolean
	} | null
}

/**
 * One value of a filter dimension. `count` is how many variants of the current narrowing carry
 * it, counted with every active filter except this dimension's own (TD-0008 §5.3) — so ticking
 * one value never empties its siblings. `null` only when the backend predates facets and the
 * list was rebuilt from `filter_options`; the sidebar then shows no numbers.
 */
export interface FacetValue {
	value: string
	count: number | null
}

export interface CatalogResponse {
	items: CatalogItem[]
	pagination: {
		total: number
		page: number
		limit: number
		totalPages: number
	}
	/** Over the whole category, not the narrowing: the slider's bounds must not jump. */
	price_range: { min: number; max: number }
	/**
	 * Every value of every `required_attributes` dimension, in the category's order, with a
	 * count per the rule on `FacetValue`. Optional only for the deploy window in which the
	 * storefront is newer than the backend — read it through `catalogFacets`.
	 */
	facets?: Record<string, FacetValue[]>
	/** @deprecated The same values without counts; removed after the next release (Plan-0007). */
	filter_options?: Record<string, string[]>
	/**
	 * One entry per colour family present in the category, with a swatch to paint. `count`
	 * follows the facet rule: narrowed by everything except colour, zero kept.
	 */
	color_options: { family: string; count: number; hex_stops: string[] }[]
}

/**
 * The facet lists of a response, whichever shape the backend sent. A backend older than the
 * storefront has no `facets`; rebuilding the lists from `filter_options` keeps every dimension
 * in the sidebar (without numbers) instead of hiding them all as "fewer than two values".
 */
export const catalogFacets = (
	response: Pick<CatalogResponse, 'facets' | 'filter_options'> | null | undefined
): Record<string, FacetValue[]> => {
	if (response?.facets) return response.facets
	const rebuilt: Record<string, FacetValue[]> = {}
	for (const [key, values] of Object.entries(response?.filter_options ?? {})) {
		rebuilt[key] = values.map(value => ({ value, count: null }))
	}
	return rebuilt
}

export type CatalogQueryParams = Record<string, string> & { category_id: string }

export const getCatalogProducts = (params: CatalogQueryParams): Promise<CatalogResponse> => {
	return httpService.get<CatalogResponse, unknown>(API_URLS.PRODUCTS.CATALOG, { params })
}

export const getVariantBySlug = (slug: string): Promise<ProductDetailData> => {
	return httpService.get<ProductDetailData, unknown>(API_URLS.PRODUCTS.BY_SLUG(slug))
}

export const getCategoryBySlug = (slug: string): Promise<Category> => {
	return httpService.get<Category, unknown>(API_URLS.CATEGORIES.BY_SLUG(slug), {
		schema: categorySchema
	})
}
