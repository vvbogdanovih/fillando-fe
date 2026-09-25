import { describe, expect, it } from 'vitest'
import { LEGACY_PRODUCT_SLUGS, legacyProductRedirects } from './legacy-product-redirects'

const entries = Object.entries(LEGACY_PRODUCT_SLUGS)

describe('LEGACY_PRODUCT_SLUGS', () => {
	it('is one hop: no target is itself an old slug', () => {
		// A chain would answer 301 → 301 → page; Google gives up after a few hops.
		const chained = entries.filter(([, to]) => to in LEGACY_PRODUCT_SLUGS)

		expect(chained).toEqual([])
	})

	it('never redirects a slug onto itself', () => {
		expect(entries.filter(([from, to]) => from === to)).toEqual([])
	})

	it('holds plain slugs only, so no entry turns into a path-to-regexp pattern', () => {
		// `:`, `(`, `*` or `/` in a source would widen the match beyond the one old address.
		const unsafe = entries.flat().filter(slug => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))

		expect(unsafe).toEqual([])
	})
})

describe('legacyProductRedirects', () => {
	it('maps an old indexed address to the current product page permanently', () => {
		const redirect = legacyProductRedirects().find(
			r =>
				r.source ===
				'/products/filament-plastyk-dlia-3d-pryntera-kingroon-pla-dual-silk-175-mm-1-kh-chorno-zolotystyy'
		)

		expect(redirect).toEqual({
			source: '/products/filament-plastyk-dlia-3d-pryntera-kingroon-pla-dual-silk-175-mm-1-kh-chorno-zolotystyy',
			destination: '/products/kingroon-pla-dual-silk-black-gold-silk',
			permanent: true
		})
	})

	it('emits one redirect per old slug', () => {
		expect(legacyProductRedirects()).toHaveLength(entries.length)
	})
})
