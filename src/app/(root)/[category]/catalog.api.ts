import { httpService } from '@/common/services/http.service'
import type { PublicColor } from '@/common/utils/color.utils'
import { API_URLS } from '@/common/constants'
import { categorySchema, type Category } from '@/app/admin/categories/categories.schema'

/**
 * The shop's own promotion (TD-0012): `sale_price` is what the shopper pays while it is on, `price`
 * stays the regular price. All three are null without an active promo and absent from a backend
 * that predates them — read them through `effectivePrice` / `isPromoActive`, never directly.
 */
export interface PromoFields {
	sale_price?: number | null
	promo_percent?: number | null
	promo_ends_at?: string | null
}

export interface CatalogItem extends PromoFields {
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

/**
 * What a product's other SKUs add to its first one in a strip (`GET /products/catalog/v2/strip`):
 * the SKUs of the product under the strip's scope and filters — an «Акції» group is the SKUs on
 * sale, not the whole product.
 */
export interface StripGroup {
	/** The product's name, without the SKU value. */
	name: string
	count: number
	in_stock: number
	/** How many of them are on a live promotion. */
	on_sale: number
	/** What the shopper pays, over the in-stock SKUs; over all of them when none is in stock. */
	price_min: number
	price_max: number
	/** Distinct dictionary colours; equal to `count` when the group is a row of colours. */
	colors_count: number
	/** At most 12, in-stock first; a sold-out colour is marked, not left out. */
	colors: { family: string | null; hex_stops: string[]; in_stock: boolean }[]
}

/** A strip card: the listing item of the product's first SKU, and its group. */
export interface StripItem extends CatalogItem {
	/** The product this card stands for — what a page compares to show no product twice. */
	product_id: string
	group: StripGroup
}

export interface ProductDetailData {
	/**
	 * New catalogue only: the product's own purchase notice (owner, 2026-11-05) — shown above the
	 * buy button, `badge` over the photo. `null` means none; absent on a v1 page, which keeps the
	 * built-in `ATTR_NOTES`.
	 */
	attribute_notice?: { title: string; text: string; badge: string | null } | null
	/**
	 * v2 only: the values of the characteristics that declare size/material — the same text the
	 * Merchant feed sends as `g:size` / `g:material`. Absent on a v1 page (filament `polymer` rule).
	 */
	semantic_values?: { size: string | null; material: string | null }

	variant: PromoFields & {
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
		/**
		 * `unit` comes from the category's `required_attributes[].unit` — the value itself is
		 * stored bare («Вага | 1»), so the specification table needs it to print «1 кг».
		 */
		attributes: { k: string; l: string; v: string | number | boolean; unit?: string | null }[]
		/**
		 * `semantic` (v2 only) is the axis meaning: a `color`/`size`/`material` axis becomes the
		 * ProductGroup's `variesBy`; `generic` (current, length…) is never passed off as one.
		 */
		variant_type: {
			key: string
			label: string
			semantic?: 'generic' | 'color' | 'size' | 'material'
		} | null
		/**
		 * The brand. v2: the product's brand entity, else the characteristic marked «Бренд»; v1:
		 * the «Виробник» attribute. Never the vendor, which is the supplier.
		 */
		manufacturer: string | null
	}
	siblings: (PromoFields & {
		id: string
		name: string
		slug: string
		price: number
		price_updated_at: string | null
		stock: number
		v_value: string | null
		images: string[]
		color: PublicColor | null
	})[]
	category_slug: string
	category_name: string
	/** Root-first ancestors ending with the product's own category; absent from older backends. */
	category_path?: { _id: string; name: string; slug: string }[]
	/**
	 * A path too long to embed (Plan-0010 D06.4): `category_path` is then the category alone and
	 * the page reads the ancestors with `loadCategoryAncestors`.
	 */
	category_path_paged?: true
	category_path_total?: number
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
