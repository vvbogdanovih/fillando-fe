import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import type { CatalogTreeNode } from '@/common/utils/catalog-tree.utils'
import { loadCollectionStrips, loadStrip } from '@/common/utils/catalog-strips.server'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import { loadStorefrontSettings } from '@/common/utils/storefront-settings.server'
import type { StripItem } from '@/app/(root)/[category]/catalog.api'
import type { PopularLanding } from '@/app/(root)/[category]/components/PopularLandings'
import type { StorefrontPublic } from '@/app/admin/storefront/storefront.schema'
import { HUB_DETAIL_READS, tileChildren, type HubLanding } from './catalog-hub'
import type { PublicCategory } from './typed-catalog.types'

export type CategoryLanding = HubLanding & { filters_v2?: Record<string, unknown> }

/**
 * SERVER ONLY. Published landings of a product category — the pills (the category's «Популярні
 * види», the hub's «Популярні добірки») and the exact-match redirect. One author of the URL and
 * tag array: the category route and the hub share one Data Cache entry. A failure must not take
 * the page down — it only costs the tiles and the landing redirect.
 */
export const loadCategoryLandings = (categoryId: string) =>
	serverFetch<CategoryLanding[]>(`/landings?category_id=${categoryId}`, {
		next: { tags: [CACHE_TAGS.LANDINGS] }
	}).catch(() => null)

export interface HubTile {
	id: string
	name: string
	href: string
	count: number
	image: string | null
	/** A group's first sub-categories by name (`tileChildren`); null for a product category. */
	children: string | null
}

export interface HubData {
	tiles: HubTile[]
	landings: PopularLanding[]
	onSale: StripItem[]
	newest: StripItem[]
	/** The admin «Вітрина» collections — the whole catalogue only. */
	collections: { collection: StorefrontPublic['collections'][number]; items: StripItem[] }[]
	/** The only product category below a hub, the target of «Дивитися всі». */
	single: CatalogTreeNode | null
}

/**
 * SERVER ONLY. Everything a hub shows below its scope (`category = null` — the whole catalogue —
 * or a group): the nodes come from the tree the route already read; landings, tile photos and
 * strips are decoration (their reads are caught), bounded to {@link HUB_DETAIL_READS} reads each
 * so a catalogue of thousands of categories costs no more than a page of them.
 */
export async function loadHub(
	category: PublicCategory | null,
	nodes: CatalogTreeNode[]
): Promise<HubData> {
	const products = nodes.filter(node => node.kind === 'product').slice(0, HUB_DETAIL_READS)
	const [landingRows, details, onSale, newest, settings] = await Promise.all([
		Promise.all(products.map(node => loadCategoryLandings(node.id))),
		// The category route's own read of each (same URL, same tags): one Data Cache entry.
		Promise.all(
			nodes.slice(0, HUB_DETAIL_READS).map(node =>
				serverFetch<{ image?: string | null }>(`/categories/slug/${node.slug}`, {
					next: { tags: [CACHE_TAGS.CATEGORIES] }
				}).catch(() => null)
			)
		),
		loadStrip({ category_id: category?._id, filters: { on_sale: true } }),
		loadStrip({ category_id: category?._id }),
		category ? null : loadStorefrontSettings()
	])
	const landings = new Map(products.map((node, index) => [node.id, landingRows[index] ?? []]))
	const single = nodes.length === 1 && nodes[0].kind === 'product' ? nodes[0] : null
	return {
		tiles: nodes.map((node, index) => ({
			id: node.id,
			name: node.name,
			href: node.href,
			count: node.count,
			image: details[index]?.image ?? null,
			children: tileChildren(node)
		})),
		landings: products.flatMap(node =>
			(landings.get(node.id) ?? []).map(landing => ({
				slug: landing.slug,
				h1: landing.h1,
				image: landing.image ?? null,
				product_count: landing.product_count ?? null,
				category: { slug: node.slug, name: node.name }
			}))
		),
		onSale,
		newest,
		collections: settings
			? (await loadCollectionStrips(settings.collections)).filter(row => row.items.length)
			: [],
		single
	}
}
