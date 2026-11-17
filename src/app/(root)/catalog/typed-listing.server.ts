import type { Metadata } from 'next'
import { API_URLS } from '@/common/constants/api-routes.constants'
import { CACHE_TAGS } from '@/common/constants/cache-tags.constants'
import { serverFetch } from '@/common/utils/server-fetch.utils'
import {
	apiQuery,
	legacyListingQuery,
	parseListingParams,
	visitorDefinitions,
	withPinned,
	type TypedFilterState,
	type TypedListingState
} from './typed-filters'
import { typedListingDecision, type TypedListingDecision } from './typed-indexing'
import type { PublicCategory, TypedCatalogResponse } from './typed-catalog.types'

type RawSearchParams = Record<string, string | string[] | undefined>

export interface TypedListing {
	path: string
	state: TypedListingState | null
	response: TypedCatalogResponse | null
	decision: TypedListingDecision
	/** The API query the SSR response was fetched with — the client seeds its cache by it. */
	query: string | null
}

export const toSearchParams = (raw: RawSearchParams) => {
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(raw))
		for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value])
			query.append(key, item)
	return query
}

/** Characteristics a listing may filter by: only a v2 product category has its own. */
export const scopeDefinitions = (category: PublicCategory | null) =>
	category?.kind === 'product' && category.attribute_contract_version === 2
		? category.attribute_definitions
		: []

/**
 * SERVER ONLY. One typed listing — the whole catalogue (`category = null`), a group with every
 * visible product category below it, or one v2 product category — decided against the SEO
 * matrix. Called by both `generateMetadata` and the page with the same arguments, so the two
 * share one Data Cache entry (same URL, same tag array) and agree on the status.
 */
export async function loadTypedListing(
	category: PublicCategory | null,
	rawParams: RawSearchParams,
	/** Product categories a `category=` narrowing may name; anything else is an unknown key. */
	scopeCategoryIds: string[],
	/** A landing of this category: its path and typed pins. */
	landing: { slug: string; pinned: TypedFilterState } | null = null
): Promise<TypedListing> {
	const path = category ? `/${category.slug}${landing ? `/${landing.slug}` : ''}` : '/catalog'
	const raw = toSearchParams(rawParams)
	const pinned = landing?.pinned ?? null
	const definitions = visitorDefinitions(scopeDefinitions(category), pinned)
	const parsed = parseListingParams(raw, definitions)
	// An old v1 filter address of a migrated category: one 301 to the typed equivalent.
	const legacy = parsed ? null : legacyListingQuery(raw, definitions)
	if (legacy) {
		const query = legacy.toString()
		return {
			path,
			state: null,
			response: null,
			query: null,
			decision: { kind: 'redirect', to: query ? `${path}?${query}` : path }
		}
	}
	const allowed = new Set(scopeCategoryIds)
	const state = parsed && parsed.filters.category_ids.every(id => allowed.has(id)) ? parsed : null
	if (!state || state.explicitFirstPage)
		return {
			path,
			state,
			response: null,
			query: null,
			decision: typedListingDecision(path, state, raw, null)
		}
	const query = apiQuery(
		{ ...state, filters: withPinned(state.filters, pinned) },
		category?._id ?? null
	)
	// `null` is a 404 only: the category became hidden between the two reads. Anything else
	// (400 for a contract mismatch, 429, 5xx) throws into the error boundary, never an empty page.
	const response = await serverFetch<TypedCatalogResponse>(
		`${API_URLS.PRODUCTS.CATALOG_V2}?${query}`,
		{ next: { tags: [CACHE_TAGS.PRODUCTS] } }
	)
	return {
		path,
		state,
		response,
		query,
		decision: response
			? typedListingDecision(path, state, raw, response)
			: { kind: 'not_found' }
	}
}

/** Title, description, canonical and robots of a typed listing, from the same decision. */
export function typedListingMetadata(
	category: PublicCategory | null,
	listing: TypedListing,
	landing: { title: string; meta_description: string } | null = null
): Metadata {
	if (listing.decision.kind === 'not_found')
		return { title: 'Сторінку не знайдено', robots: { index: false, follow: false } }
	const name = category?.name ?? 'Каталог товарів'
	const page = listing.state?.page ?? 1
	// A landing's stored title is a finished SEO title that already carries the brand.
	const base = landing?.title || category?.seo.title?.trim() || `${name} — купити у Fillando`
	const title = page > 1 ? `${base} — сторінка ${page}` : base
	const description =
		landing?.meta_description ||
		category?.seo.description?.trim() ||
		(category
			? `${name} у магазині Fillando: ціни, наявність і доставка по Україні.`
			: 'Каталог товарів Fillando: усі категорії, ціни, наявність і доставка по Україні.')
	const decision = listing.decision.kind === 'render' ? listing.decision : null
	return {
		title: landing ? { absolute: title } : title,
		description,
		...(decision?.canonical ? { alternates: { canonical: decision.canonical } } : {}),
		...(decision?.robots ? { robots: decision.robots } : {}),
		openGraph: {
			title,
			description,
			type: 'website',
			...(decision?.canonical ? { url: decision.canonical } : {})
		}
	}
}
