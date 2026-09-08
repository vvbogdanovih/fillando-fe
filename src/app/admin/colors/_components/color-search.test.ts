import { describe, expect, it } from 'vitest'
import type { AdminColor } from '../colors.schema'
import { filterColors } from './color-search'

const color = (over: Partial<AdminColor> & Pick<AdminColor, 'name_en'>) =>
	({
		_id: over.name_en,
		name_uk: `${over.name_en} укр`,
		slug: over.name_en.toLowerCase().replace(/\s+/g, '-'),
		family: 'black',
		hex_stops: ['#111418'],
		order: 0,
		variant_count: 0,
		...over
	}) as AdminColor

const MINT = color({ name_en: 'Mint', name_uk: 'М’ятний', family: 'green' })
const ROYAL = color({ name_en: 'Royal Blue', name_uk: 'Королівський синій', family: 'blue' })
const BLACK = color({ name_en: 'Black', name_uk: 'Чорний' })
const ALL = [MINT, ROYAL, BLACK]

describe('filterColors', () => {
	it('returns the same array for a blank query, so the screen can tell nothing is filtering', () => {
		expect(filterColors(ALL, '')).toBe(ALL)
		expect(filterColors(ALL, '   ')).toBe(ALL)
	})

	it.each([
		['Ukrainian name', 'королів', [ROYAL]],
		['English name', 'royal', [ROYAL]],
		['slug', 'royal-blue', [ROYAL]],
		['family key', 'blue', [ROYAL]],
		['Ukrainian family label', 'Сині', [ROYAL]],
		['case-insensitive', 'BLACK', [BLACK]]
	])('matches by %s', (_what, query, expected) => {
		expect(filterColors(ALL, query)).toEqual(expected)
	})

	it('does not care which apostrophe the admin types', () => {
		expect(filterColors(ALL, "м'ятн")).toEqual([MINT])
		expect(filterColors(ALL, 'мʼятн')).toEqual([MINT])
	})

	it('returns nothing for a query no field contains', () => {
		expect(filterColors(ALL, 'бірюз')).toEqual([])
	})
})
