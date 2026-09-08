import { describe, expect, it } from 'vitest'
import type { AdminLanding } from '../landings.schema'
import { filterLandings } from './landing-search'

const landing = (over: Partial<AdminLanding> & Pick<AdminLanding, 'h1'>) =>
	({
		_id: over.h1,
		category_id: 'cat1',
		slug: over.h1.toLowerCase().replace(/\s+/g, '-'),
		title: `${over.h1} — купити`,
		meta_description: '',
		intro_html: '',
		bottom_html: '',
		faq: [],
		filters: {},
		price_min: null,
		price_max: null,
		image: null,
		order: 0,
		status: 'draft',
		product_count: 0,
		...over
	}) as AdminLanding

const SILK = landing({ h1: 'PLA Silk', status: 'active' })
const REFILL = landing({ h1: 'Філамент-рефіл', slug: 'refill', title: 'Рефіл без котушки' })
const ALL = [SILK, REFILL]

describe('filterLandings', () => {
	it('returns the same array for a blank query', () => {
		expect(filterLandings(ALL, '')).toBe(ALL)
	})

	it.each([
		['H1', 'silk', [SILK]],
		['title', 'без котушки', [REFILL]],
		['slug', 'refill', [REFILL]],
		['status key', 'draft', [REFILL]],
		['status label', 'Опубліковано', [SILK]],
		['status label, partial and lower-case', 'чернетк', [REFILL]]
	])('matches by %s', (_what, query, expected) => {
		expect(filterLandings(ALL, query)).toEqual(expected)
	})

	it('does not match the public address, which the list does not carry', () => {
		expect(filterLandings(ALL, 'filament/refill')).toEqual([])
	})
})
