import { describe, expect, it, vi } from 'vitest'

const { SITE } = vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SITE_URL = 'https://fillando.com'
	return { SITE: 'https://fillando.com' }
})

import type { CatalogTreeNode } from '@/common/utils/catalog-tree.utils'
import { HUB_TILE_CHILDREN, hubDecision, tileChildren } from './catalog-hub'

const decide = (query: string, empty = false) =>
	hubDecision('/catalog', new URLSearchParams(query), empty)

describe('hubDecision (TD-0013 SEO matrix, hub rows)', () => {
	it('renders the bare address self-canonical, and tracking parameters as the clean page', () => {
		expect(decide('')).toEqual({ kind: 'render', canonical: `${SITE}/catalog` })
		expect(decide('utm_source=google&gclid=abc')).toEqual({
			kind: 'render',
			canonical: `${SITE}/catalog`
		})
	})

	// Google Ads auto-tagging appends `gad_source` / `gad_campaignid` beside `gclid` to every click:
	// read as a listing parameter, each paid visit to the hub was a 404 (review 2026-11-14).
	it('reads the click ids ad platforms append as attribution, never as a listing parameter', () => {
		const ads = 'gclid=x&gad_source=1&gad_campaignid=2'
		expect(decide(ads)).toEqual({ kind: 'render', canonical: `${SITE}/catalog` })
		expect(decide(`page=3&${ads}`)).toEqual({ kind: 'redirect', to: `/catalog?${ads}` })
		expect(decide('bogus=1')).toEqual({ kind: 'not_found' })
		expect(decide(`bogus=1&${ads}`)).toEqual({ kind: 'not_found' })
	})

	it('keeps a known empty hub out of the index, without a canonical', () => {
		expect(decide('', true)).toEqual({ kind: 'render', robots: { index: false, follow: true } })
	})

	it('sends a former listing page to the bare address once, attribution kept', () => {
		expect(decide('page=3')).toEqual({ kind: 'redirect', to: '/catalog' })
		expect(decide('page=2&gclid=abc')).toEqual({ kind: 'redirect', to: '/catalog?gclid=abc' })
	})

	it('answers 404 for anything a hub cannot produce', () => {
		for (const query of [
			'page=0',
			'page=abc',
			'page=2&page=3',
			'page=2&sort=price_asc',
			'sort=price_asc',
			'limit=48',
			'f.polymer=PLA',
			'category=0123456789abcdef01234567',
			'color=black'
		])
			expect(decide(query), query).toEqual({ kind: 'not_found' })
	})
})

const node = (over: Partial<CatalogTreeNode>): CatalogTreeNode => ({
	id: 'p1',
	name: 'Філамент',
	slug: 'filament',
	href: '/filament',
	kind: 'product',
	count: 10,
	children: [],
	...over
})

describe('tileChildren', () => {
	it('says nothing under a product category: its landings are pills, not sub-categories (owner, 10.11)', () => {
		expect(tileChildren(node({}))).toBeNull()
		expect(tileChildren(node({ kind: 'group' }))).toBeNull()
	})

	it("names a group's first sub-categories and counts the rest", () => {
		const children = (count: number) =>
			Array.from({ length: count }, (_, n) =>
				node({ id: `c${n}`, name: `Категорія ${n + 1}`, href: `/c-${n}` })
			)
		expect(tileChildren(node({ kind: 'group', children: children(2) }))).toBe(
			'Категорія 1, Категорія 2'
		)
		expect(tileChildren(node({ kind: 'group', children: children(HUB_TILE_CHILDREN) }))).toBe(
			'Категорія 1, Категорія 2, Категорія 3'
		)
		expect(tileChildren(node({ kind: 'group', children: children(12) }))).toBe(
			'Категорія 1, Категорія 2, Категорія 3 та ще 9'
		)
	})
})
