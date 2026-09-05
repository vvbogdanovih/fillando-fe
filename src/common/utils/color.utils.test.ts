import { describe, expect, it } from 'vitest'
import { catalogItemName, colorLabel, variantLabel, type PublicColor } from './color.utils'

const BLACK: PublicColor = {
	name_uk: 'Чорний',
	name_en: 'Black',
	family: 'black',
	hex_stops: ['#111111']
}

describe('colorLabel', () => {
	it('shows the Ukrainian name with the manufacturer name in brackets', () => {
		expect(colorLabel(BLACK)).toBe('Чорний (Black)')
	})

	it('does not repeat a name that is the same in both languages', () => {
		expect(colorLabel({ ...BLACK, name_uk: 'Candy', name_en: 'Candy' })).toBe('Candy')
	})

	it.each([
		['only the English name', { ...BLACK, name_uk: '' }, 'Black'],
		['only the Ukrainian name', { ...BLACK, name_en: '' }, 'Чорний'],
		[
			'names padded with spaces',
			{ ...BLACK, name_uk: ' Чорний ', name_en: ' Black ' },
			'Чорний (Black)'
		]
	])('handles %s', (_case, color, expected) => {
		expect(colorLabel(color as PublicColor)).toBe(expected)
	})

	it.each([[null], [undefined]])('returns null for %p', value => {
		expect(colorLabel(value)).toBeNull()
	})
})

describe('variantLabel', () => {
	/**
	 * The order is the point of the whole task: `normalize-variant-colors.js` rewrites `v_value`
	 * to the English name, so a storefront reading it first would flip to English the moment the
	 * migration runs (Plan-0004 §4, ordering rule 2).
	 */
	it('prefers the dictionary colour over the raw value', () => {
		expect(variantLabel({ v_value: 'Black', color: BLACK })).toBe('Чорний (Black)')
	})

	it('still prefers the dictionary when the raw value is the old Ukrainian spelling', () => {
		expect(variantLabel({ v_value: 'Чорна', color: BLACK })).toBe('Чорний (Black)')
	})

	it('falls back to the raw value for a variant with no dictionary entry', () => {
		// Half the range is still unmatched after the migration — those keep their spelling.
		expect(variantLabel({ v_value: 'Веселковий R1', color: null })).toBe('Веселковий R1')
	})

	it.each([
		['neither value', { v_value: null, color: null }],
		['an empty variant', {}]
	])('returns null for %s, so the caller can fall back to the name', (_case, variant) => {
		expect(variantLabel(variant)).toBeNull()
	})
})

describe('catalogItemName', () => {
	const gold = { name_uk: 'Золотий', name_en: 'Gold', family: 'gold', hex_stops: ['#d4af37'] }

	it('spells the colour the way the product page does', () => {
		expect(catalogItemName({ name: 'Sunlu PLA Silk — Золотий', color: gold })).toBe(
			'Sunlu PLA Silk — Золотий (Gold)'
		)
	})

	it('leaves a name that does not end in its colour alone', () => {
		expect(catalogItemName({ name: 'Sunlu PLA Silk 1 кг', color: gold })).toBe(
			'Sunlu PLA Silk 1 кг'
		)
	})

	it('changes nothing when the two names are the same word', () => {
		const candy = {
			name_uk: 'Candy',
			name_en: 'Candy',
			family: 'multicolor',
			hex_stops: ['#f0f']
		}
		expect(catalogItemName({ name: 'Kingroon PLA — Candy', color: candy })).toBe(
			'Kingroon PLA — Candy'
		)
	})

	it('changes nothing for a variant with no dictionary colour', () => {
		expect(catalogItemName({ name: 'Kingroon PLA — Rainbow', color: null })).toBe(
			'Kingroon PLA — Rainbow'
		)
	})
})
