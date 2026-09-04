import { describe, expect, it } from 'vitest'
import { findMatchingLanding, listingIndexing, type LandingCanonical } from './seo.utils'
import { SITE_URL } from '@/common/constants/seo.constants'

describe('listingIndexing — pagination is indexable', () => {
	it('canonicalises the bare listing to itself', () => {
		expect(listingIndexing('/filament', {})).toEqual({ canonical: `${SITE_URL}/filament` })
	})

	it('gives page 2 a self-canonical, not a pointer back to page 1', () => {
		// Canonicalising page 2 to page 1 is the common mistake: it tells Google the products
		// that appear only on page 2 do not need indexing.
		const result = listingIndexing('/filament', { page: '2' })

		expect(result.canonical).toBe(`${SITE_URL}/filament?page=2`)
		expect(result.robots).toBeUndefined()
	})

	it.each([['1'], ['0'], ['-3'], ['abc'], ['']])(
		'treats page=%p as the first page and drops it from the canonical',
		page => {
			expect(listingIndexing('/filament', { page }).canonical).toBe(`${SITE_URL}/filament`)
		}
	)

	it('reads the first value when the parameter repeats', () => {
		expect(listingIndexing('/filament', { page: ['3', '9'] }).canonical).toBe(
			`${SITE_URL}/filament?page=3`
		)
	})
})

describe('listingIndexing — filter combinations are not', () => {
	it.each([
		['a single filter', { polymer: 'PLA' }],
		['a colour filter', { color_family: 'black' }],
		['a sort order', { sort: 'price_asc' }],
		['a page size', { limit: '48' }],
		['several at once', { polymer: 'PLA', finish: 'Silk', sort: 'price_desc' }]
	])('marks %s noindex, follow', (_case, params) => {
		const result = listingIndexing('/filament', params)

		expect(result.robots).toEqual({ index: false, follow: true })
	})

	it('follows, so the crawler still reaches the products through the grid', () => {
		expect(listingIndexing('/filament', { polymer: 'PLA' }).robots?.follow).toBe(true)
	})

	it('points a filtered page at the listing without the filters', () => {
		expect(listingIndexing('/filament', { polymer: 'PLA', page: '2' }).canonical).toBe(
			`${SITE_URL}/filament`
		)
	})

	it('ignores parameters Next passes as undefined or empty', () => {
		const result = listingIndexing('/filament', { polymer: undefined, finish: '' })

		expect(result.robots).toBeUndefined()
		expect(result.canonical).toBe(`${SITE_URL}/filament`)
	})

	it('works for a landing path too, which PR-5 will reuse', () => {
		expect(listingIndexing('/filament/pla-silk', { color_family: 'black' })).toEqual({
			canonical: `${SITE_URL}/filament/pla-silk`,
			robots: { index: false, follow: true }
		})
	})
})

describe('findMatchingLanding', () => {
	const LANDINGS: LandingCanonical[] = [
		{ slug: 'pla', filters: { polymer: ['PLA'] } },
		{ slug: 'pla-silk', filters: { polymer: ['PLA'], finish: ['Silk'] } },
		{ slug: 'glow', filters: { finish: ['Glow', 'Luminous'] } },
		{ slug: 'carbon', filters: { reinforcement: ['CF'] } }
	]

	it('finds the landing that says exactly what the query says', () => {
		expect(findMatchingLanding(LANDINGS, { polymer: 'PLA' })?.slug).toBe('pla')
	})

	it('matches a two-dimension landing', () => {
		expect(findMatchingLanding(LANDINGS, { polymer: 'PLA', finish: 'Silk' })?.slug).toBe(
			'pla-silk'
		)
	})

	it('matches a multi-value dimension regardless of the order it was written in', () => {
		expect(findMatchingLanding(LANDINGS, { finish: 'Luminous,Glow' })?.slug).toBe('glow')
	})

	it('refuses a query narrower than the landing', () => {
		// `?polymer=PLA&finish=Silk` is a smaller set than `/filament/pla`; canonicalising it
		// there would point Google at a page listing products the query excludes.
		expect(findMatchingLanding([LANDINGS[0]], { polymer: 'PLA', finish: 'Silk' })).toBeNull()
	})

	it('refuses a query wider than the landing', () => {
		expect(findMatchingLanding(LANDINGS, { finish: 'Silk' })).toBeNull()
	})

	it('refuses a partial multi-value match', () => {
		expect(findMatchingLanding(LANDINGS, { finish: 'Glow' })).toBeNull()
	})

	it.each([
		['pagination', { polymer: 'PLA', page: '2' }],
		['a page size', { polymer: 'PLA', limit: '48' }],
		['a sort order', { polymer: 'PLA', sort: 'price_asc' }]
	])('ignores %s when matching', (_case, params) => {
		expect(findMatchingLanding(LANDINGS, params)?.slug).toBe('pla')
	})

	it('returns null for an unfiltered listing, which is already canonical', () => {
		expect(findMatchingLanding(LANDINGS, {})).toBeNull()
		expect(findMatchingLanding(LANDINGS, { page: '3' })).toBeNull()
	})

	it('returns null when nothing matches', () => {
		expect(findMatchingLanding(LANDINGS, { polymer: 'TPU' })).toBeNull()
	})

	it('ignores a landing with no pinned filters rather than matching everything', () => {
		expect(findMatchingLanding([{ slug: 'empty', filters: {} }], { polymer: 'PLA' })).toBeNull()
	})

	it('tolerates blanks and spacing in the query', () => {
		expect(findMatchingLanding(LANDINGS, { polymer: ' PLA ,', finish: '' })?.slug).toBe('pla')
	})
})
