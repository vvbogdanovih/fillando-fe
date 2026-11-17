import { SITE_URL } from '@/common/constants/seo.constants'
import {
	DEFAULT_LIMIT,
	hasFilters,
	LEGACY_LIMIT,
	trackingQuery,
	type TypedListingState
} from './typed-filters'

export type TypedListingDecision =
	| { kind: 'not_found' }
	| { kind: 'redirect'; to: string }
	| { kind: 'render'; canonical?: string; robots?: { index: boolean; follow: boolean } }

/**
 * The SEO matrix of TD-0013 §2 for a typed listing, decided once for the page and its metadata.
 *
 * - an address the page cannot produce, a page past the end, or filters with no result: 404;
 * - `?page=1`: permanent redirect to the bare address, other parameters kept;
 * - filters, sort or page size: a working page, `noindex, follow`, no canonical — it is not
 *   pointed at the wider listing, which does not list the same products;
 * - a known listing with nothing in it: `noindex, follow`, no canonical, kept out of the sitemap;
 * - otherwise indexable and self-canonical, `?page=N` included; tracking parameters are ignored.
 *
 * Transitional (owner decision 31.10.2026; revisit after the Search Console baseline, Plan-0010
 * D02): the legacy listings had 12 per page. At the default 24, a `?page=N` past the end is one
 * permanent redirect to page ceil(N/2) when that page exists (else 404), and the legacy `?limit=36`
 * one redirect to `limit=48` when its page exists. Pages that exist are never redirected.
 */
export function typedListingDecision(
	path: string,
	state: TypedListingState | null,
	rawQuery: URLSearchParams,
	result: { total: number; limit: number } | null
): TypedListingDecision {
	if (!state) return { kind: 'not_found' }
	if (state.explicitFirstPage) {
		const rest = new URLSearchParams(rawQuery)
		rest.delete('page')
		const query = rest.toString()
		return { kind: 'redirect', to: query ? `${path}?${query}` : path }
	}
	if (!result) return { kind: 'render', robots: { index: false, follow: true } }
	const filtered = hasFilters(state.filters)
	const pages = Math.max(1, Math.ceil(result.total / result.limit))
	if (filtered && result.total === 0) return { kind: 'not_found' }
	const moved = (set: Record<string, string | null>) => {
		const rest = new URLSearchParams(rawQuery)
		for (const [key, value] of Object.entries(set))
			if (value === null) rest.delete(key)
			else rest.set(key, value)
		const query = rest.toString()
		return { kind: 'redirect' as const, to: query ? `${path}?${query}` : path }
	}
	if (state.page > pages) {
		// The page that starts with the old page's first item: ceil(N / 2) for 12 → 24.
		const page = Math.ceil((state.page * LEGACY_LIMIT.size) / DEFAULT_LIMIT)
		return !rawQuery.has('limit') && state.limit === DEFAULT_LIMIT && page <= pages
			? moved({ page: page > 1 ? String(page) : null })
			: { kind: 'not_found' }
	}
	if (state.legacyLimit) return moved({ limit: String(LEGACY_LIMIT.to) })
	if (filtered || state.view || result.total === 0)
		return { kind: 'render', robots: { index: false, follow: true } }
	return {
		kind: 'render',
		canonical: `${SITE_URL}${path}${state.page > 1 ? `?page=${state.page}` : ''}`
	}
}

/**
 * A narrowing exactly equal to a published landing is that landing (SEO matrix): the one
 * permanent redirect to it keeps the page and the visitor's attribution (`source` — the address
 * asked for, or its legacy translation), as the other redirects of a listing do.
 */
export function landingRedirect(
	categoryPath: string,
	landingSlug: string,
	page: number,
	source: URLSearchParams
): string {
	const query = new URLSearchParams(page > 1 ? { page: String(page) } : {})
	for (const [key, value] of trackingQuery(source)) query.append(key, value)
	const rest = query.toString()
	return `${categoryPath}/${landingSlug}${rest ? `?${rest}` : ''}`
}
