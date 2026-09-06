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

export interface CatalogResponse {
	items: CatalogItem[]
	pagination: {
		total: number
		page: number
		limit: number
		totalPages: number
	}
	price_range: { min: number; max: number }
	filter_options: Record<string, string[]>
	/** One entry per colour family present in the category, with a swatch to paint. */
	color_options: { family: string; count: number; hex_stops: string[] }[]
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
