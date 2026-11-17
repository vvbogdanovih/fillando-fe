import { API_URLS } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import type { StorefrontPublic } from '@/app/admin/storefront/storefront.schema'
import type { StripGroup, StripItem } from '@/app/(root)/[category]/catalog.api'
import type { TypedCatalogItem } from '@/app/(root)/catalog/typed-catalog.types'

/** Cards in one product strip («Новинки», «Акції», an admin collection). */
export const STRIP_SIZE = 8
/**
 * What the home page reads for one collection shelf: the most the backend gives a strip. A shelf
 * shows five, but skips the products already standing higher on the page — with eight read, a
 * collection over the shop's main category had one card left after «Новинки».
 */
export const SHELF_FETCH = 24

/**
 * SERVER ONLY. The address of one strip: `/products/catalog/v2/strip` answers one card per product
 * — its first SKU in the «newest» listing, with the group its other SKUs make (owner, 2026-11-14;
 * the SKU listing's first page was one product in seven colours). The parameter order is fixed —
 * `next.tags` is not part of the fetch cache key, so the home page and the catalogue hub must
 * build the same string for the same strip to share one Data Cache entry (the whole catalogue's
 * «Новинки» is `?limit=8` on both). A caller that reads another `limit` reads another entry.
 */
export const stripUrl = (
	scope: { category_id?: string | null; filters?: object | null },
	limit = STRIP_SIZE
) => {
	const query = new URLSearchParams({
		...(scope.category_id ? { category_id: scope.category_id } : {}),
		limit: String(limit),
		...(scope.filters ? { filters: JSON.stringify(scope.filters) } : {})
	})
	return `${API_URLS.PRODUCTS.CATALOG_V2_STRIP}?${query.toString()}`
}

export interface CatalogStripResponse {
	revision: number
	items: (TypedCatalogItem & { group: StripGroup })[]
}

/**
 * The storefront card is shared with v1; a typed SKU has no legacy colour or attributes. `null` is
 * a backend without the strip endpoint (a 404): no strip, like an empty one.
 */
export const toCards = (response: CatalogStripResponse | null): StripItem[] =>
	(response?.items ?? []).map(item => ({ ...item, attributes: [], color: item.color ?? null }))

/**
 * SERVER ONLY. One strip that is decoration on its page (docs/http-service.md, «decoration»
 * catch): a failure — an outage, or an older backend refusing a filter it does not know — only
 * drops the strip, never the page around it.
 */
export const loadStrip = (scope: Parameters<typeof stripUrl>[0], limit = STRIP_SIZE) =>
	serverFetch<CatalogStripResponse>(stripUrl(scope, limit), {
		next: { tags: [CACHE_TAGS.PRODUCTS] }
	})
		.then(toCards)
		.catch(() => [] as StripItem[])

/**
 * SERVER ONLY. The admin «Вітрина» collections as strips: a category, one of its landings (its
 * pins as `filters`) or an explicit list of products (`filters.product_ids` over the whole
 * catalogue). Shared by the home page and `/catalog`.
 */
export const loadCollectionStrips = (
	collections: StorefrontPublic['collections'],
	limit = STRIP_SIZE
) =>
	Promise.all(
		collections.map(async collection => ({
			collection,
			items: await loadStrip(
				{ category_id: collection.category_id, filters: collection.filters },
				limit
			)
		}))
	)
