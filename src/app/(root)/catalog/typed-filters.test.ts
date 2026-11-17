import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
	process.env.NEXT_PUBLIC_SITE_URL = 'https://fillando.com'
})

import {
	apiFilters,
	apiQuery,
	emptyFilters,
	legacyListingQuery,
	listingQuery,
	parseListingParams,
	sameFilters,
	valueLabel,
	visitorDefinitions,
	withAttribute,
	withPinned
} from './typed-filters'
import { landingRedirect, typedListingDecision } from './typed-indexing'
import type { PublicDefinition } from './typed-catalog.types'

const definition = (key: string, extra: Partial<PublicDefinition>): PublicDefinition => ({
	key,
	label: key,
	value_type: 'string',
	unit: null,
	filter_enabled: true,
	filter_type: 'multi-select',
	order: 0,
	multiple: false,
	options: [],
	...extra
})
const AVR = [
	definition('current', { value_type: 'number', unit: 'А', filter_type: 'range', order: 0 }),
	definition('automatic', { value_type: 'boolean', order: 1 }),
	definition('poles', {
		value_type: 'enum',
		order: 2,
		options: [{ id: 'four', label: 'Чотири', order: 0 }]
	}),
	definition('label', { order: 3 }),
	definition('hidden', { filter_enabled: false, filter_type: null, order: 4 })
]
const parse = (query: string) => parseListingParams(new URLSearchParams(query), AVR)

describe('parseListingParams', () => {
	it('reads typed values, a range, scope narrowing and view parameters', () => {
		const state = parse(
			'f.label=Чорний, білий&f.automatic=false&f.current.min=16&f.current.max=63&f.poles=four' +
				'&price.max=900&in_stock=1&sort=price_asc&page=2&utm_source=ads'
		)!
		expect(state.filters.attributes).toEqual([
			{ key: 'current', min: 16, max: 63 },
			{ key: 'automatic', values: [false] },
			{ key: 'poles', values: ['four'] },
			// A comma is part of the value, never a separator.
			{ key: 'label', values: ['Чорний, білий'] }
		])
		expect(state).toMatchObject({
			sort: 'price_asc',
			page: 2,
			view: true,
			tracking: true,
			filters: { price: { max: 900 }, in_stock: true }
		})
	})

	it('rejects what the page cannot produce instead of silently dropping it', () => {
		for (const query of [
			'bogus=1',
			'f.hidden=x',
			'f.unknown=x',
			'f.automatic=maybe',
			'f.poles=five',
			'f.current=16',
			'f.label.min=1',
			'f.current.min=63&f.current.max=16',
			'page=0',
			'page=2&page=3',
			'sort=random',
			'limit=13',
			'in_stock=0',
			'category=not-an-id',
			'price.min=-1',
			'f.label=a&f.label=a'
		])
			expect(parse(query), query).toBeNull()
	})

	it('flags an explicit first page for the redirect', () => {
		expect(parse('page=1')).toMatchObject({ explicitFirstPage: true, page: 1 })
	})

	it('accepts no local characteristics in group/global scope', () => {
		expect(parseListingParams(new URLSearchParams('f.label=x'), [])).toBeNull()
		expect(
			parseListingParams(new URLSearchParams(`category=${'a'.repeat(24)}`), [])
		).not.toBeNull()
	})
})

describe('listingQuery / apiQuery', () => {
	it('writes one canonical address per state and round-trips', () => {
		const state = parse('f.poles=four&f.current.max=63&page=3&in_stock=1')!
		const query = listingQuery(state)
		expect(query).toBe('f.current.max=63&f.poles=four&in_stock=1&page=3')
		expect(parse(query)!.filters).toEqual(state.filters)
	})

	it('omits defaults and page 1', () => {
		expect(listingQuery({ ...parse('')!, page: 1 })).toBe('')
	})

	it('reads a characteristic below zero, never a price (audit, 2026-11-07)', () => {
		// The backend accepts a negative characteristic range, and the slider writes one when the
		// scope goes below zero: the page must read its own address back instead of a 404.
		const state = parse('f.current.min=-20&f.current.max=10.5')!
		expect(state.filters.attributes).toEqual([{ key: 'current', min: -20, max: 10.5 }])
		expect(listingQuery(state)).toBe('f.current.min=-20&f.current.max=10.5')
		expect(parse(listingQuery(state))!.filters).toEqual(state.filters)
		for (const query of [
			'price.min=-1',
			'price.max=-0.5',
			'f.current.min=--1',
			'f.current.min=-',
			'f.current.min=1e3',
			'f.current.min=-1.1234567'
		])
			expect(parse(query), query).toBeNull()
	})

	it('sends one JSON filters object with empty parts omitted', () => {
		const state = parse('f.automatic=true&price.min=10')!
		expect(JSON.parse(apiFilters(state.filters))).toEqual({
			attributes: [{ key: 'automatic', values: [true] }],
			price: { min: 10 }
		})
		const query = new URLSearchParams(apiQuery(state, 'c'.repeat(24)))
		expect(Object.fromEntries(query)).toMatchObject({
			category_id: 'c'.repeat(24),
			page: '1',
			limit: '24',
			sort: 'newest'
		})
	})
})

describe('labels and updates', () => {
	it('shows option labels, Так/Ні and units — never an enum id', () => {
		expect(valueLabel(AVR[2], 'four')).toBe('Чотири')
		expect(valueLabel(AVR[1], false)).toBe('Ні')
		expect(valueLabel(AVR[0], 16)).toBe('16 А')
	})

	it('removes an emptied characteristic and keeps category order', () => {
		const order = AVR.map(row => row.key)
		const state = parse('f.poles=four')!.filters
		const added = withAttribute(state, 'current', { key: 'current', min: 1 }, order)
		expect(added.attributes.map(row => row.key)).toEqual(['current', 'poles'])
		expect(
			withAttribute(added, 'poles', { key: 'poles', values: [] }, order).attributes
		).toEqual([{ key: 'current', min: 1 }])
	})
})

describe('typedListingDecision (SEO matrix)', () => {
	const raw = (query: string) => new URLSearchParams(query)
	const decide = (query: string, total: number, limit = 24) =>
		typedListingDecision('/avr', parse(query), raw(query), { total, limit })

	it('indexes the clean listing and its later pages self-canonically', () => {
		expect(decide('', 30)).toEqual({ kind: 'render', canonical: 'https://fillando.com/avr' })
		expect(decide('page=2', 30)).toEqual({
			kind: 'render',
			canonical: 'https://fillando.com/avr?page=2'
		})
		expect(decide('utm_source=x', 30)).toEqual({
			kind: 'render',
			canonical: 'https://fillando.com/avr'
		})
	})

	// Google Ads auto-tagging appends `gad_source` / `gad_campaignid` beside `gclid` to every click:
	// read as an unknown parameter, each paid visit to a category or a landing was a 404.
	it('reads the click ids ad platforms append as attribution: the clean, indexable page', () => {
		const ads = 'gclid=x&gad_source=1&gad_campaignid=2'
		expect(parse(ads)).toMatchObject({ tracking: true, view: false, filters: emptyFilters() })
		expect(decide(ads, 30)).toEqual({ kind: 'render', canonical: 'https://fillando.com/avr' })
		expect(decide(`page=2&${ads}`, 30)).toEqual({
			kind: 'render',
			canonical: 'https://fillando.com/avr?page=2'
		})
		expect(decide(`page=3&${ads}`, 30)).toEqual({ kind: 'redirect', to: `/avr?page=2&${ads}` })
		for (const key of [
			'gclsrc',
			'dclid',
			'_gl',
			'ttclid',
			'twclid',
			'ysclid',
			'igshid',
			'mc_cid',
			'mc_eid',
			'li_fat_id',
			'epik',
			'_hsenc',
			'_hsmi'
		])
			expect(parse(`${key}=1`), key).toMatchObject({ tracking: true })
		// An unknown parameter is still an address this page cannot produce, with or without them.
		expect(decide('bogus=1', 30)).toEqual({ kind: 'not_found' })
		expect(decide(`bogus=1&${ads}`, 30)).toEqual({ kind: 'not_found' })
		expect(decide('gad=1', 30)).toEqual({ kind: 'not_found' })
	})

	it('noindexes filters, views and a known empty listing without a canonical', () => {
		for (const [query, total] of [
			['in_stock=1', 3],
			['sort=price_desc', 30],
			['', 0]
		] as const)
			expect(decide(query, total)).toEqual({
				kind: 'render',
				robots: { index: false, follow: true }
			})
	})

	it('answers 404 for unknown input, pages past the end and filters without results', () => {
		expect(decide('bogus=1', 30)).toEqual({ kind: 'not_found' })
		// Past the end even at half the number (the transitional rule below cannot land it).
		expect(decide('page=5', 30)).toEqual({ kind: 'not_found' })
		expect(decide('in_stock=1', 0)).toEqual({ kind: 'not_found' })
		expect(decide('in_stock=1&page=2', 0)).toEqual({ kind: 'not_found' })
		// An explicit page size has no transitional mapping: its pages are what they say.
		expect(decide('limit=12&page=4', 30, 12)).toEqual({ kind: 'not_found' })
	})

	// Transitional (owner decision 31.10.2026, revisit after the Search Console baseline D02): the
	// legacy listings had 12 per page, so an indexed `?page=N` past the end of the 24-per-page
	// listing lands on page ceil(N/2) once, and `?limit=36` (a legacy option) on 48.
	it('lands an old page number past the end on ceil(N/2), if that page exists', () => {
		expect(decide('page=3', 30)).toEqual({ kind: 'redirect', to: '/avr?page=2' })
		expect(decide('page=4&utm_source=x', 30)).toEqual({
			kind: 'redirect',
			to: '/avr?page=2&utm_source=x'
		})
		expect(decide('in_stock=1&page=2', 3)).toEqual({ kind: 'redirect', to: '/avr?in_stock=1' })
		// A page that exists is never touched.
		expect(decide('page=2', 30)).toEqual({
			kind: 'render',
			canonical: 'https://fillando.com/avr?page=2'
		})
	})
	it('lands the legacy page size 36 on 48, the page kept when it exists', () => {
		expect(parse('limit=36')).toMatchObject({ limit: 48, legacyLimit: true, view: true })
		expect(decide('limit=36', 30, 48)).toEqual({ kind: 'redirect', to: '/avr?limit=48' })
		expect(decide('sort=price_asc&limit=36&gclid=z', 30, 48)).toEqual({
			kind: 'redirect',
			to: '/avr?sort=price_asc&limit=48&gclid=z'
		})
		expect(decide('limit=36&page=3', 30, 48)).toEqual({ kind: 'not_found' })
		expect(parse('limit=36&limit=48')).toBeNull()
	})

	it('redirects ?page=1 and keeps the other parameters', () => {
		expect(
			typedListingDecision(
				'/avr',
				parse('page=1&utm_source=x'),
				raw('page=1&utm_source=x'),
				null
			)
		).toEqual({ kind: 'redirect', to: '/avr?utm_source=x' })
	})
})

describe('landingRedirect — a narrowing exactly equal to a published landing', () => {
	it('keeps the page and the attribution of the address asked for', () => {
		expect(landingRedirect('/filament', 'pla', 1, new URLSearchParams('f.polymer=PLA'))).toBe(
			'/filament/pla'
		)
		expect(
			landingRedirect(
				'/filament',
				'pla',
				2,
				new URLSearchParams('f.polymer=PLA&utm_campaign=y&page=2&gclid=abc')
			)
		).toBe('/filament/pla?page=2&utm_campaign=y&gclid=abc')
		// Nothing but attribution survives: the filters are the landing itself.
		expect(
			landingRedirect('/filament', 'pla', 1, new URLSearchParams('polymer=PLA&gclid=abc'))
		).toBe('/filament/pla?gclid=abc')
		// An ad click keeps every id the platform appended, not `gclid` alone.
		expect(
			landingRedirect(
				'/filament',
				'pla',
				1,
				new URLSearchParams('f.polymer=PLA&gclid=x&gad_source=1&gad_campaignid=2')
			)
		).toBe('/filament/pla?gclid=x&gad_source=1&gad_campaignid=2')
	})
})

describe('migrated filament (colour axis, landings, legacy addresses)', () => {
	const FILAMENT = [
		definition('polymer', { order: 0 }),
		definition('finish', { order: 1 }),
		definition('vaha', { value_type: 'number', unit: 'кг', order: 2 }),
		definition('color', {
			semantic: 'color',
			filter_enabled: false,
			filter_type: null,
			order: 3
		})
	]
	const parseF = (query: string) => parseListingParams(new URLSearchParams(query), FILAMENT)

	it('accepts dictionary families only where the category has a colour axis', () => {
		expect(parseF('color=black&color=white')!.filters.color_families).toEqual([
			'black',
			'white'
		])
		expect(parseF('color=plaid')).toBeNull()
		expect(parse('color=black')).toBeNull()
		expect(listingQuery(parseF('color=white&color=black')!)).toBe('color=black&color=white')
		expect(JSON.parse(apiFilters(parseF('color=black')!.filters))).toEqual({
			color_families: ['black']
		})
	})

	it('translates the legacy v1 query format, keeping tracking parameters', () => {
		const query = legacyListingQuery(
			new URLSearchParams('polymer=PLA,PETG&color_family=black&price_min=100&utm_source=ads'),
			FILAMENT
		)
		expect(query?.toString()).toBe(
			'f.polymer=PETG&f.polymer=PLA&color=black&price.min=100&utm_source=ads'
		)
		expect(legacyListingQuery(new URLSearchParams('f.polymer=PLA'), FILAMENT)).toBeNull()
		expect(legacyListingQuery(new URLSearchParams('polymer=PLA&bogus=1'), FILAMENT)).toBeNull()
	})

	it('pins a landing: its keys leave the visitor parser and always win in the request', () => {
		const pinned = { ...emptyFilters(), attributes: [{ key: 'polymer', values: ['PLA'] }] }
		const visitor = visitorDefinitions(FILAMENT, pinned)
		expect(parseListingParams(new URLSearchParams('f.polymer=PETG'), visitor)).toBeNull()
		const state = parseListingParams(new URLSearchParams('f.finish=Silk'), visitor)!
		expect(withPinned(state.filters, pinned).attributes).toEqual([
			{ key: 'finish', values: ['Silk'] },
			{ key: 'polymer', values: ['PLA'] }
		])
	})

	it('matches a landing exactly, whatever the order', () => {
		const landing = {
			...emptyFilters(),
			attributes: [
				{ key: 'polymer', values: ['PLA'] },
				{ key: 'finish', values: ['Silk'] }
			]
		}
		expect(sameFilters(parseF('f.finish=Silk&f.polymer=PLA')!.filters, landing)).toBe(true)
		expect(
			sameFilters(parseF('f.finish=Silk&f.polymer=PLA&in_stock=1')!.filters, landing)
		).toBe(false)
	})
})
