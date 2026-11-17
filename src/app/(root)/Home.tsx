import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { API_URLS, SITE_NAME, UI_URLS } from '@/common/constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import {
	type CatalogStripResponse,
	SHELF_FETCH,
	loadCollectionStrips,
	loadStrip,
	stripUrl,
	toCards
} from '@/common/utils/catalog-strips.server'
import { loadCatalogTree } from '@/common/utils/catalog-tree.server'
import { findTreeNode, type CatalogTreeNode } from '@/common/utils/catalog-tree.utils'
import { getCategoryNavLinks } from '@/common/utils/navigation.utils'
import { readStorefrontSettings } from '@/common/utils/storefront-settings.server'
import type { StorefrontContent, StorefrontPublic } from '@/app/admin/storefront/storefront.schema'
import { loadCategoryLandings } from './catalog/catalog-hub.server'
import { CollectionShelf } from './_home/CollectionShelf'
import { FeaturedProducts } from './_home/FeaturedProducts'
import { HomeCategoryMenu, MENU_ROOTS, type MenuCategory } from './_home/HomeCategoryMenu'
import { PromoBand } from './_home/PromoBand'
import { PromoBanner } from './_home/PromoBanner'
import { SidePromo } from './_home/SidePromo'
import { dedupeShelves, isPickedList } from './_home/shelves'

/**
 * Without the settings (a backend that has none, or an answer this storefront cannot read — an
 * outage fails the render, see `readStorefrontSettings`) the banner still has its H1: the shop's
 * name, a way into the catalogue, nothing about any product.
 */
const OFFLINE_BANNER: StorefrontContent['banner'] = {
	eyebrow: '',
	title: SITE_NAME,
	accent: '',
	text: '',
	button_label: 'До каталогу',
	button_href: UI_URLS.CATALOG.ROOT
}

/**
 * A menu category's photo, read as its own page reads it — the same URL and tags, one Data Cache
 * entry (like the hub's tiles). Decoration: a failure, or a link that is not a category's own
 * `/<slug>` address, leaves a plain tile.
 */
async function categoryImage(href: string): Promise<string | null> {
	if (!/^\/[^/?#]+$/.test(href)) return null
	const category = await serverFetch<{ image?: string | null }>(
		API_URLS.CATEGORIES.BY_SLUG(href.slice(1)),
		{ next: { tags: [CACHE_TAGS.CATEGORIES] } }
	).catch(() => null)
	return category?.image ?? null
}

/**
 * What a shelf's cover shows beside the title (owner, 2026-11-14): the photo and the count of what
 * the collection points at — its landing (the admin's tile image, the landing's own count), else
 * its category (the photo and the count its hub tile shows). A list the admin picked by hand
 * points at nothing: a plain cover. Decoration, read through the reads their own pages make (one
 * Data Cache entry each): a failure leaves the cover without the photo or the count.
 */
async function shelfCover(
	collection: StorefrontPublic['collections'][number],
	tree: CatalogTreeNode[]
): Promise<{ image: string | null; count: number | null }> {
	if (!collection.category_id || !collection.path) return { image: null, count: null }
	const node = findTreeNode(tree, collection.category_id)
	const categoryHref = node?.href ?? `/${collection.path.split('/')[1]}`
	if (collection.path !== categoryHref) {
		const slug = collection.path.slice(categoryHref.length + 1)
		const landing = (await loadCategoryLandings(collection.category_id))?.find(
			row => row.slug === slug
		)
		return {
			image: landing?.image ?? (await categoryImage(categoryHref)),
			count: landing?.product_count ?? null
		}
	}
	return { image: await categoryImage(categoryHref), count: node?.count ?? null }
}

/**
 * The home page as a marketplace's (TD-0015, owner 2026-11-09): the category menu, the banner over
 * «Аврора» and the card beside it, then «Новинки» in one row, the band and the collections as
 * shelves — a dark cover and the cards beside it, no product twice on the page (owner,
 * 2026-11-14). Every text is «Вітрина» copy — no product or category is written here.
 */
export const Home = async () => {
	// The newest products of the whole public catalogue, one card each (TD-0013; owner, 2026-11-14).
	// The same address as the catalogue hub's «Новинки» (`stripUrl`), with the same tags: one Data
	// Cache entry (Plan-0005 I-h).
	const catalog = await serverFetch<CatalogStripResponse>(stripUrl({}), {
		next: { tags: [CACHE_TAGS.PRODUCTS] }
	})
	const newest = toCards(catalog)
	const [links, settings, onSale, tree] = await Promise.all([
		getCategoryNavLinks(),
		// Not caught: an outage must fail this prerendered page, never be cached as one without its
		// copy and shelves. The layout's read of the same address stays decoration.
		readStorefrontSettings(),
		// The hub's «Акції» strip (same address): the menu offers it only while it has products.
		loadStrip({ filters: { on_sale: true } }),
		// For the covers' counts — the tree the menu has just read (the same requests); without it
		// a cover only loses its count.
		loadCatalogTree().catch(() => [] as CatalogTreeNode[])
	])
	const [categories, collections] = await Promise.all([
		Promise.all(
			links.slice(0, MENU_ROOTS).map(
				async (link): Promise<MenuCategory> => ({
					href: link.href,
					label: link.label,
					image: await categoryImage(link.href)
				})
			)
		),
		// A category, one of its landings, or an explicit list of products (`filters.product_ids`).
		// More than a shelf shows: it skips what «Новинки» and the shelves above already show.
		loadCollectionStrips(settings?.collections ?? [], SHELF_FETCH)
	])
	const shelves = await Promise.all(
		dedupeShelves(newest, collections).map(async shelf => ({
			...shelf,
			cover: await shelfCover(shelf.collection, tree)
		}))
	)

	return (
		<div className='container mx-auto max-w-7xl px-4'>
			<div className='grid gap-4 py-4 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_280px]'>
				<HomeCategoryMenu
					categories={categories}
					onSale={onSale.length > 0}
					newest={newest.length > 0}
				/>
				<PromoBanner banner={settings?.banner ?? OFFLINE_BANNER} />
				{settings && (
					<div className='grid md:col-span-2 lg:col-span-1'>
						<SidePromo promo={settings.side_promo} />
					</div>
				)}
			</div>
			{/* One eager card: on a computer the row's photos are one size and the first one painted
			    is the page's LCP (lazy, it cost ~0.5 s in Lighthouse, 2026-11-11); on a phone the row
			    is below the fold, so more preloads would only compete with the CSS and the fonts. */}
			{newest.length > 0 && <FeaturedProducts items={newest} layout='rail' eagerCards={1} />}
			{settings?.band && <PromoBand band={settings.band} />}
			{shelves.length > 0 && (
				<div className='space-y-10 pt-4 pb-12'>
					{shelves.map(({ collection, items, cover }, index) => (
						<CollectionShelf
							key={collection.id}
							title={collection.title}
							// A product list has no page of its own: the cover leads to the catalogue.
							href={collection.path ?? UI_URLS.CATALOG.ROOT}
							label={collection.path ? 'Дивитися всі' : 'До каталогу'}
							image={cover.image}
							count={cover.count}
							items={items}
							// A list picked by hand: all of it, in a row that scrolls (owner, 2026-11-15).
							rail={isPickedList(collection)}
							// Each cover its own cut of the live background.
							shift={(0.15 + index * 0.37) % 1}
						/>
					))}
				</div>
			)}
		</div>
	)
}
