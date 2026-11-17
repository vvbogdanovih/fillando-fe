import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import type { Crumb } from '@/common/components/Breadcrumbs'
import { UI_URLS } from '@/common/constants/ui-routes.constants'
import { loadCatalogTree, loadCategoryAncestors } from '@/common/utils/catalog-tree.server'
import { findTreeNode } from '@/common/utils/catalog-tree.utils'
import type { MovedTargetDecision } from '@/common/utils/moved-route.server'
import { CATALOG_INTRO_HTML } from './catalog-intro'
import { hubDecision } from './catalog-hub'
import { loadCategoryLandings, loadHub } from './catalog-hub.server'
import { CatalogHub } from './CatalogHub'
import { TypedCatalogPage } from './TypedCatalogPage'
import {
	emptyFilters,
	hasFilters,
	parseListingParams,
	sameFilters,
	type TypedFilterState
} from './typed-filters'
import {
	loadTypedListing,
	scopeDefinitions,
	toSearchParams,
	typedListingMetadata,
	type TypedListing
} from './typed-listing.server'
import { landingRedirect, type TypedListingDecision } from './typed-indexing'
import type { PublicCategory } from './typed-catalog.types'

type RawSearchParams = Record<string, string | string[] | undefined>

/** `GET /landings/slug/:category/:landing` of a v2 category: typed pins in `filters_v2`. */
export interface TypedLanding {
	slug: string
	h1: string
	title: string
	meta_description: string
	intro_html: string
	bottom_html: string
	faq: { q: string; a: string }[]
	filters_v2: Partial<TypedFilterState>
}

const pinnedOf = (landing: Pick<TypedLanding, 'filters_v2'>): TypedFilterState => ({
	...emptyFilters(),
	...landing.filters_v2,
	attributes: (landing.filters_v2.attributes ?? []) as TypedFilterState['attributes']
})

/** The whole catalogue and every group are the hub (Plan-0010 P20); a product category lists. */
const isHub = (category: PublicCategory | null): boolean => !category || category.kind === 'group'

/** A hub's scope from the public tree: the nodes below it, their SKUs and the SEO decision. */
async function resolveHub(category: PublicCategory | null, searchParams: RawSearchParams) {
	const tree = await loadCatalogTree()
	const node = category ? findTreeNode(tree, category._id) : null
	const nodes = category ? (node?.children ?? []) : tree
	// A published group the tree pruned holds no active SKU: the known empty state (noindex).
	const total = category ? (node?.count ?? 0) : tree.reduce((sum, row) => sum + row.count, 0)
	const path = category ? `/${category.slug}` : UI_URLS.CATALOG.ROOT
	const decision = hubDecision(path, toSearchParams(searchParams), total === 0)
	return { nodes, total, path, decision }
}

/** A hub's decision in the shape of a listing, for the shared metadata author. */
const hubListing = (path: string, decision: TypedListingDecision): TypedListing => ({
	path,
	state: null,
	response: null,
	query: null,
	decision
})

/** A v2 product category or one of its typed landings, decided against the SEO matrix. */
async function resolve(
	category: PublicCategory,
	searchParams: RawSearchParams,
	landing: TypedLanding | null
) {
	const listing = await loadTypedListing(
		category,
		searchParams,
		[category._id],
		landing ? { slug: landing.slug, pinned: pinnedOf(landing) } : null
	)
	const landings = landing ? null : await loadCategoryLandings(category._id)
	// A narrowing exactly equal to a published landing is that landing: one permanent redirect
	// (SEO matrix), whether the address used the typed or the legacy v1 query format.
	// A page past the end stays the 404 it is (the landing lists the same products).
	const decision = listing.decision
	const source =
		decision.kind === 'redirect'
			? new URL(decision.to, 'http://local').searchParams
			: toSearchParams(searchParams)
	const state =
		decision.kind === 'redirect'
			? parseListingParams(source, scopeDefinitions(category))
			: listing.state
	if (decision.kind !== 'not_found' && state && !state.view && hasFilters(state.filters)) {
		const match = (landings ?? []).find(
			row =>
				row.filters_v2 &&
				sameFilters(
					state.filters,
					pinnedOf({ filters_v2: row.filters_v2 as TypedLanding['filters_v2'] })
				)
		)
		if (match)
			listing.decision = {
				kind: 'redirect',
				to: landingRedirect(`/${category.slug}`, match.slug, state.page, source)
			}
	}
	return { listing, landings }
}

/**
 * SERVER ONLY. What a typed address answers for a query — its own redirect, a 404, or `null` (it
 * renders): an old address of a moved category follows it in one hop (P03).
 */
export async function typedRouteDecision(
	category: PublicCategory,
	searchParams: RawSearchParams
): Promise<MovedTargetDecision> {
	const decision = isHub(category)
		? (await resolveHub(category, searchParams)).decision
		: (await resolve(category, searchParams, null)).listing.decision
	if (decision.kind === 'not_found') return { kind: 'not_found' }
	if (decision.kind === 'redirect') return { kind: 'redirect', to: decision.to }
	return null
}

/**
 * SERVER ONLY. Metadata for the whole catalogue (`category = null`), a group, a v2 product
 * category or one of its typed landings. The 404/redirect is raised here as well as in the
 * page, so metadata never describes a page that does not exist. Real status codes also need
 * these routes to have no `loading.tsx`: a streaming boundary commits a 200 first.
 */
export async function typedRouteMetadata(
	category: PublicCategory | null,
	searchParams: RawSearchParams,
	landing: TypedLanding | null = null
): Promise<Metadata> {
	// A landing belongs to a product category (the writer refuses a group): never to a hub.
	if (landing && isHub(category)) notFound()
	const listing =
		!category || isHub(category)
			? await resolveHub(category, searchParams).then(hub =>
					hubListing(hub.path, hub.decision)
				)
			: (await resolve(category, searchParams, landing)).listing
	if (listing.decision.kind === 'not_found') notFound()
	if (listing.decision.kind === 'redirect') permanentRedirect(listing.decision.to)
	return typedListingMetadata(category, listing, landing)
}

/** Головна → Каталог → the category's path → the landing; `null` when the path became hidden. */
async function trailOf(
	category: PublicCategory | null,
	landing: TypedLanding | null
): Promise<Crumb[] | null> {
	// A path too long to embed is read whole (D06.4); hidden since the detail was read → null.
	const ancestors = category?.ancestors_paged
		? await loadCategoryAncestors(category._id)
		: (category?.ancestors ?? [])
	if (!ancestors) return null
	return [
		{ name: 'Головна', href: UI_URLS.HOME },
		{ name: 'Каталог', href: UI_URLS.CATALOG.ROOT },
		...(category
			? [...ancestors, category].map(row => ({
					name: row.name,
					href: `/${row.slug}`
				}))
			: []),
		...(landing && category
			? [{ name: landing.h1, href: `/${category.slug}/${landing.slug}` }]
			: [])
	]
}

export async function TypedRoute({
	category,
	searchParams,
	landing = null
}: {
	category: PublicCategory | null
	searchParams: RawSearchParams
	landing?: TypedLanding | null
}) {
	if (!category || isHub(category)) {
		if (landing) notFound()
		const hub = await resolveHub(category, searchParams)
		if (hub.decision.kind === 'redirect') permanentRedirect(hub.decision.to)
		if (hub.decision.kind === 'not_found') notFound()
		const crumbs = await trailOf(category, null)
		if (!crumbs) notFound()
		return (
			<CatalogHub
				h1={category?.seo.h1?.trim() || category?.name || 'Каталог товарів'}
				crumbs={crumbs}
				total={hub.total}
				// The whole catalogue's intro is storefront copy in code (owner, 2026-11-03).
				introHtml={category ? (category.seo.intro_html ?? null) : CATALOG_INTRO_HTML}
				bottomHtml={category?.seo.bottom_html ?? null}
				data={await loadHub(category, hub.nodes)}
				root={!category}
			/>
		)
	}
	const { listing, landings } = await resolve(category, searchParams, landing)
	if (listing.decision.kind === 'redirect') permanentRedirect(listing.decision.to)
	if (listing.decision.kind === 'not_found' || !listing.response || !listing.query) notFound()
	const crumbs = await trailOf(category, landing)
	if (!crumbs) notFound()
	return (
		<Suspense>
			<TypedCatalogPage
				scope={{
					categoryId: category._id,
					path: listing.path,
					name: category.name,
					h1: landing?.h1 || category.seo.h1?.trim() || category.name,
					crumbs,
					definitions: scopeDefinitions(category),
					introHtml: landing
						? landing.intro_html || null
						: (category.seo.intro_html ?? null),
					bottomHtml: landing
						? landing.bottom_html || null
						: (category.seo.bottom_html ?? null),
					pinned: landing ? pinnedOf(landing) : null,
					faq: landing?.faq ?? [],
					popularLandings: (landings ?? []).map(row => ({
						slug: row.slug,
						h1: row.h1,
						image: row.image ?? null,
						product_count: row.product_count ?? null
					})),
					categorySlug: landing ? null : category.slug
				}}
				initialResponse={listing.response}
				initialQuery={listing.query}
			/>
		</Suspense>
	)
}
