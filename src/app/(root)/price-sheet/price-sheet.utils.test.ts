import { describe, expect, it } from 'vitest'
import { adminVariantSchema } from './price-sheet.schema'
import { priceSheetSections, priceSheetSummary } from './price-sheet.utils'

const row = (id: string, category?: string, extra: object = {}) =>
	adminVariantSchema.parse({
		id,
		slug: id,
		image: null,
		name: id,
		...(category ? { category_id: category } : {}),
		manufacturer: null,
		color: null,
		article: null,
		price: 1,
		in_stock: true,
		stock: 1,
		synced_at: null,
		...extra
	})
const filament = {
	id: 'c1',
	name: 'Філамент',
	columns: [{ key: 'polymer', label: 'Тип пластику' }],
	variant_column: false
}

describe('priceSheetSections', () => {
	it('groups consecutive rows by category, continuing across pages', () => {
		const sections = priceSheetSections(
			[row('a', 'c1'), row('b', 'c1'), row('c', 'c2')],
			[filament, { ...filament, id: 'c2', name: 'АВР', columns: [] }, filament]
		)
		expect(sections.map(section => [section.name, section.items.map(item => item.id)])).toEqual(
			[
				['Філамент', ['a', 'b']],
				['АВР', ['c']]
			]
		)
	})

	it('keeps «Варіант» when any page of a category asks for it', () => {
		const [section] = priceSheetSections(
			[row('a', 'c1')],
			[filament, { ...filament, variant_column: true }]
		)
		expect(section.variant_column).toBe(true)
	})

	it('reads an older flat answer as one unnamed section with «Варіант»', () => {
		const sections = priceSheetSections([row('a'), row('b')], [])
		expect(sections).toHaveLength(1)
		expect(sections[0]).toMatchObject({ name: null, columns: [], variant_column: true })
	})
})

describe('priceSheetSummary', () => {
	it('names each value, then the variation; a dash when there is nothing', () => {
		const [section] = priceSheetSections([row('a', 'c1')], [filament])
		expect(
			priceSheetSummary(row('a', 'c1', { values: { polymer: 'PLA' } }), {
				...section,
				variant_column: true
			})
		).toBe('Тип пластику: PLA')
		expect(
			priceSheetSummary(
				row('a', 'c1', { values: { polymer: 'PLA' }, variant_label: '63 А' }),
				{
					...section,
					variant_column: true
				}
			)
		).toBe('Тип пластику: PLA · 63 А')
		expect(priceSheetSummary(row('a', 'c1'), section)).toBe('—')
	})
})
