import type { PromoFields } from '@/app/(root)/[category]/catalog.api'
import type { PublicColor } from '@/common/utils/color.utils'

/** A typed attribute value as the v2 API stores and filters it (TD-0013 §6). */
export type TypedScalar = string | number | boolean

/** One characteristic of a v2 product category; the storefront reads only what it renders. */
export interface PublicDefinition {
	key: string
	label: string
	value_type: 'string' | 'number' | 'boolean' | 'enum'
	unit: string | null
	filter_enabled: boolean
	filter_type: 'multi-select' | 'range' | null
	order: number
	multiple: boolean
	/** `color`: the axis holds dictionary colours, filtered by family, never by raw id. */
	semantic?: 'generic' | 'color' | 'size' | 'material' | 'brand'
	options: { id: string; label: string; order: number }[]
}

export interface CategoryCrumb {
	_id: string
	name: string
	slug: string
}

/** `GET /categories/slug/:slug` — the public adapter's v1/v2 detail, groups included. */
export interface PublicCategory extends CategoryCrumb {
	kind: 'group' | 'product'
	parent_id: string | null
	attribute_contract_version: 1 | 2
	revision: number
	order: number
	image: string | null
	ancestors: CategoryCrumb[]
	/**
	 * A path too long to embed (Plan-0010 D06.4): `ancestors` is then empty on purpose and the
	 * whole path is read with `loadCategoryAncestors`. Absent at any ordinary depth.
	 */
	ancestors_paged?: true
	ancestors_total?: number
	attribute_definitions: PublicDefinition[]
	seo: {
		title: string | null
		description: string | null
		h1: string | null
		intro_html: string | null
		bottom_html: string | null
	}
}

export interface TypedCatalogItem extends PromoFields {
	id: string
	product_id: string
	category_id: string
	name: string
	slug: string
	sku: string
	price: number
	stock: number
	price_updated_at: string | null
	v_value: string | null
	variant_value: TypedScalar | null
	main_image: string | null
	brand_id: string | null
	/** Dictionary colour of a colour-axis SKU; null otherwise (and from older backends). */
	color?: PublicColor | null
}

export interface CountFacet {
	id: string
	label: string
	count: number
}

export interface AttributeFacet {
	key: string
	values: { value: TypedScalar; count: number }[]
	min: number | null
	max: number | null
}

/** `GET /products/catalog/v2`. One SKU is one row; counts follow the self-excluding rule. */
export interface TypedCatalogResponse {
	revision: number
	page: number
	limit: number
	total: number
	items: TypedCatalogItem[]
	facets: {
		attributes: AttributeFacet[]
		categories: CountFacet[]
		brands: CountFacet[]
		price: { min: number | null; max: number | null }
		in_stock: { true: number; false: number }
		/** Colour families of a colour-axis category, self-excluding counts; absent elsewhere. */
		colors?: { family: string; count: number; hex_stops: string[] }[]
	}
}
