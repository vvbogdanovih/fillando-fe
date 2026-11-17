import { SITE_URL } from '@/common/constants/seo.constants'
import type { CatalogTreeNode } from '@/common/utils/catalog-tree.utils'
import { trackingQuery } from './typed-filters'
import type { TypedListingDecision } from './typed-indexing'

/**
 * The catalogue hub (Plan-0010 P20, owner 2026-11-03): `/catalog` and every group are navigation —
 * entry tiles, landing pills and product strips — never a product grid. A grid with only «Ціна»
 * and «Наявність» made shoppers take it for the place to filter, while the characteristics live
 * one click further, on the product category.
 */

/**
 * The anchors of the whole catalogue's «Акції» and «Новинки» strips: the home page's menu leads to
 * them (TD-0015) — a strip has no address of its own, and a listing parameter on the hub is a 404.
 */
export const HUB_SECTIONS = { onSale: 'akcii', newest: 'novynky' } as const

/** Sub-categories a group's tile names before «та ще N». */
export const HUB_TILE_CHILDREN = 3
/**
 * Product categories whose landings the hub reads for «Популярні добірки», and tiles that get a
 * photo (one read each).
 */
export const HUB_DETAIL_READS = 24

export interface HubLanding {
	slug: string
	h1: string
	image: string | null
	product_count?: number | null
}

/**
 * What a hub address answers (TD-0013 SEO matrix, hub rows): the bare address and tracking
 * parameters render — self-canonical, or `noindex, follow` without a canonical while the scope
 * holds nothing; `?page=N` — a listing page of a group converted from a product category — is one
 * permanent redirect to the bare address, attribution kept; any other parameter (filters, sort,
 * page size, the old `category=` narrowing) is an address this page cannot produce: 404.
 */
export function hubDecision(
	path: string,
	raw: URLSearchParams,
	empty: boolean
): TypedListingDecision {
	const tracking = trackingQuery(raw)
	const rest = [...raw.keys()].filter(key => !tracking.has(key))
	if (rest.length) {
		const pages = raw.getAll('page')
		if (
			rest.every(key => key === 'page') &&
			pages.length === 1 &&
			/^[1-9]\d{0,5}$/.test(pages[0])
		) {
			const query = tracking.toString()
			return { kind: 'redirect', to: query ? `${path}?${query}` : path }
		}
		return { kind: 'not_found' }
	}
	return empty
		? { kind: 'render', robots: { index: false, follow: true } }
		: { kind: 'render', canonical: `${SITE_URL}${path}` }
}

/**
 * What a group's tile says about its branch (owner, 2026-11-14): its first sub-categories by name
 * and how many more — one muted line, not links. The left column that listed them was the tiles a
 * second time and took a quarter of the page from everything below; the links to every level are
 * in the header's «Каталог» menu, in the HTML of every page. A product category has no line: its
 * landings are «Популярні добірки», never sub-categories (owner, 2026-11-10).
 */
export function tileChildren(node: CatalogTreeNode): string | null {
	if (node.kind !== 'group' || node.children.length === 0) return null
	const names = node.children
		.slice(0, HUB_TILE_CHILDREN)
		.map(child => child.name)
		.join(', ')
	const more = node.children.length - HUB_TILE_CHILDREN
	return more > 0 ? `${names} та ще ${more}` : names
}
