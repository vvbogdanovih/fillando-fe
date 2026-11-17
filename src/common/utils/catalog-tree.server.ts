import { API_URLS, CATEGORY_TREE_PAGE_MAX } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { buildCatalogTree, type CatalogTreeNode, type PublicTreeRow } from './catalog-tree.utils'
import { serverFetch } from './server-fetch.utils'

/** One category of a path, as `GET /categories/:id/ancestors` lists it. */
export interface PathCrumb {
	_id: string
	name: string
	slug: string
}
interface AncestorsPage {
	revision: number
	total: number
	items: PathCrumb[]
	next_cursor: string | null
}

/** Page size of the cursor walks: the backend's maximum. */
const PAGE_LIMIT = CATEGORY_TREE_PAGE_MAX
/** Pages a walk may take — 1 000 000 categories, far above TD-0013 §6's 150 000-node stress. */
const PAGE_BUDGET = 1000
type WalkInit = { next: { tags: string[] } } | { cache: 'no-store' }

/** A walk saw the catalogue change between its pages: two revisions, or a vanished branch. */
const CHANGED = 'changed while paging'
const changedWhilePaging = (error: unknown) =>
	error instanceof Error &&
	(error.message.startsWith('Upstream 409') || error.message.endsWith(CHANGED))

/**
 * A cursor walk from the Data Cache, repeated once past it when the catalogue changed between
 * its pages. Every catalogue write moves the revision the cursors are bound to, but a product,
 * landing or colour edit purges `products`, not `categories`: page 1 of the older revision stays
 * cached for up to its hour, and a later page not cached yet refuses that page's cursor (409) on
 * every render — every `/catalog` page failed until the entry expired. The repeated walk reads
 * every page of the current revision; a cursor carries its revision, so cached later pages never
 * mix revisions. A second change during the repeated walk throws.
 */
async function walk<T>(tag: string, read: (init: WalkInit) => Promise<T>): Promise<T> {
	try {
		return await read({ next: { tags: [tag] } })
	} catch (error) {
		if (!changedWhilePaging(error)) throw error
		return read({ cache: 'no-store' })
	}
}

/**
 * SERVER ONLY. A category's whole path, root first, read page by page — for a detail that marks
 * its path `ancestors_paged` / `category_path_paged` because embedding it would pass 2 MiB
 * (Plan-0010 D06.4). One revision for the whole walk, as the tree. `null` when the category is
 * no longer public (hidden or removed since its detail was read): the caller answers 404.
 */
export async function loadCategoryAncestors(categoryId: string): Promise<PathCrumb[] | null> {
	return walk(CACHE_TAGS.CATEGORIES, async init => {
		const items: PathCrumb[] = []
		let cursor: string | null = null
		let revision: number | null = null
		for (let pages = 0; pages < PAGE_BUDGET; pages++) {
			const path: string = `${API_URLS.CATEGORIES.ANCESTORS(categoryId)}?limit=${PAGE_LIMIT}${
				cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
			}`
			const page = await serverFetch<AncestorsPage>(path, init)
			if (!page) {
				if (pages === 0) return null
				throw new Error(`Category path ${CHANGED}`)
			}
			if (revision !== null && page.revision !== revision)
				throw new Error(`Category path ${CHANGED}`)
			revision = page.revision
			items.push(...page.items)
			cursor = page.next_cursor
			if (!cursor) return items
		}
		throw new Error('Category path exceeds the page budget')
	})
}

interface TreePage {
	revision: number
	items: PublicTreeRow[]
	next_cursor: string | null
}

/** The one count query navigation runs: whole catalogue, one row, every product category. */
const CATALOG_COUNTS_PATH = `${API_URLS.PRODUCTS.CATALOG_V2}?limit=1`

/**
 * SERVER ONLY. The visible tree with per-branch SKU counts, empty branches removed.
 *
 * Every cursor page must carry one revision — a tree assembled from two revisions could show a
 * node under a parent it has since left — so the walk starts over once on a change, and a second
 * one throws like any upstream failure; the caller decides whether the page can live without
 * navigation. The counts come from `GET /products/catalog/v2/category-counts`, the same rule the
 * listing pages count by.
 */
export async function loadCatalogTree(): Promise<CatalogTreeNode[]> {
	const rows = await walk(CACHE_TAGS.CATEGORIES, async init => {
		const rows: PublicTreeRow[] = []
		let cursor: string | null = null
		let revision: number | null = null
		for (let pages = 0; pages < PAGE_BUDGET; pages++) {
			const path: string = `${API_URLS.CATEGORIES.TREE}?limit=${PAGE_LIMIT}${
				cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
			}`
			const page = await serverFetch<TreePage>(path, init)
			if (!page) throw new Error('Category tree is unavailable')
			if (revision !== null && page.revision !== revision)
				throw new Error(`Category tree ${CHANGED}`)
			revision = page.revision
			rows.push(...page.items)
			cursor = page.next_cursor
			if (!cursor) return rows
		}
		throw new Error('Category tree exceeds the navigation page budget')
	})
	return buildCatalogTree(rows, await loadCategoryCounts())
}

interface CountsPage {
	categories: { id: string; count: number }[]
	next_cursor: string | null
}

/**
 * Active SKUs per visible product category over the whole catalogue (Plan-0010 D06.5): every
 * page of `GET /products/catalog/v2/category-counts`, which has no 100-category limit (pages are
 * bound to the SKU write mark: a write between them is a 409 and the walk starts over). A backend
 * without it (404) is read as before — the whole-catalogue listing's category facet, which counts
 * nothing above 100 product categories.
 */
async function loadCategoryCounts(): Promise<Map<string, number>> {
	return walk(CACHE_TAGS.PRODUCTS, async init => {
		const counts = new Map<string, number>()
		let cursor: string | null = null
		for (let pages = 0; pages < 100; pages++) {
			const path: string = cursor
				? `${API_URLS.PRODUCTS.CATALOG_V2_CATEGORY_COUNTS}?cursor=${encodeURIComponent(cursor)}`
				: API_URLS.PRODUCTS.CATALOG_V2_CATEGORY_COUNTS
			const page = await serverFetch<CountsPage>(path, init)
			if (!page) {
				if (pages > 0) throw new Error('Category counts are unavailable')
				const catalog = await serverFetch<{
					facets: { categories: { id: string; count: number }[] }
				}>(CATALOG_COUNTS_PATH, { next: { tags: [CACHE_TAGS.PRODUCTS] } })
				return new Map((catalog?.facets.categories ?? []).map(row => [row.id, row.count]))
			}
			for (const row of page.categories) counts.set(row.id, row.count)
			cursor = page.next_cursor
			if (!cursor) return counts
		}
		throw new Error('Category counts exceed the navigation page budget')
	})
}
