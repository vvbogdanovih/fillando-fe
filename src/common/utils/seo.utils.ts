import { SITE_URL } from '@/common/constants/seo.constants'

type RawSearchParams = Record<string, string | string[] | undefined>

/** The only query parameter that earns its own indexable URL. */
const PAGE_PARAM = 'page'

/**
 * Canonical and robots directives for a catalogue-style listing (TD-0002 §5.4).
 *
 * Two rules, and the difference between them matters:
 *
 * - **Pagination is real content.** `/filament?page=2` holds products that appear nowhere else,
 *   so it is indexable and canonicalises to itself. Pointing page 2 at page 1 — the common
 *   mistake — tells Google those products do not need indexing.
 * - **Every other parameter is a view of content that already has a home.** Filters, sort order
 *   and page size multiply into thousands of near-identical URLs, so they are `noindex, follow`
 *   and canonicalise to the listing without them: `follow` keeps the crawler walking through to
 *   the products, `noindex` keeps the combinations out of the index.
 *
 * `page=1` is deliberately dropped from the canonical: it is the same page as the bare address,
 * and emitting both invites Google to choose.
 */
export function listingIndexing(
	path: string,
	searchParams: RawSearchParams
): { canonical: string; robots?: { index: boolean; follow: boolean } } {
	const page = readPage(searchParams[PAGE_PARAM])
	const hasOtherParams = Object.entries(searchParams).some(
		([key, value]) => key !== PAGE_PARAM && value !== undefined && value !== ''
	)

	const canonical = page > 1 ? `${SITE_URL}${path}?${PAGE_PARAM}=${page}` : `${SITE_URL}${path}`

	return hasOtherParams
		? { canonical: `${SITE_URL}${path}`, robots: { index: false, follow: true } }
		: { canonical }
}

/** A page number is only meaningful as a positive integer; anything else is page 1. */
function readPage(value: string | string[] | undefined): number {
	const raw = Array.isArray(value) ? value[0] : value
	if (typeof raw !== 'string') return 1
	const parsed = Number.parseInt(raw, 10)
	return Number.isFinite(parsed) && parsed > 1 ? parsed : 1
}

/** The subset of a landing this module needs to canonicalise a filtered listing. */
export interface LandingCanonical {
	slug: string
	filters: Record<string, string[]>
}

/** Parameters that describe a view rather than a selection of products. */
const VIEW_PARAMS = new Set([PAGE_PARAM, 'limit', 'sort'])

/**
 * The landing that says exactly what a filtered listing says, if there is one.
 *
 * `/filament?polymer=PLA` and `/filament/pla` return the same products, so leaving both
 * indexable splits the signal between them (TD-0002 §5.4). The query form stays `noindex,
 * follow` and points its canonical at the landing, which is the version with a heading and copy.
 *
 * The match has to be exact — same dimensions, same values. A landing pinning `polymer: [PLA]`
 * must not claim `?polymer=PLA&finish=Silk`, which is a narrower set of products.
 */
export function findMatchingLanding(
	landings: LandingCanonical[],
	searchParams: RawSearchParams
): LandingCanonical | null {
	const selected = new Map<string, Set<string>>()
	for (const [key, raw] of Object.entries(searchParams)) {
		if (VIEW_PARAMS.has(key)) continue
		const value = Array.isArray(raw) ? raw[0] : raw
		if (typeof value !== 'string' || value.trim() === '') continue
		selected.set(
			key,
			new Set(
				value
					.split(',')
					.map(v => v.trim())
					.filter(Boolean)
			)
		)
	}
	if (selected.size === 0) return null

	return (
		landings.find(landing => {
			const pinned = Object.entries(landing.filters).filter(([, values]) => values.length > 0)
			if (pinned.length !== selected.size) return false
			return pinned.every(([key, values]) => {
				const chosen = selected.get(key)
				return (
					chosen !== undefined &&
					chosen.size === new Set(values).size &&
					values.every(value => chosen.has(value))
				)
			})
		}) ?? null
	)
}
