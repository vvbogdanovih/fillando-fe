import { describe, expect, it } from 'vitest'
import { buildSpecRows, type ProductAttribute } from './product-attributes'

const attr = (k: string, l: string, v: string): ProductAttribute => ({ k, l, v })

describe('buildSpecRows', () => {
	it('puts the characteristics in the order the mock reads them', () => {
		const rows = buildSpecRows([
			attr('series', 'Серія', 'Basic'),
			attr('polymer', 'Тип пластику', 'PLA'),
			attr('spool_included', 'Котушка в комплекті', 'Так'),
			attr('finish', 'Ефект поверхні', 'Silk')
		])

		expect(rows.map(r => r.key)).toEqual(['spool_included', 'polymer', 'finish', 'series'])
	})

	it('keeps an unrecognised characteristic rather than dropping it', () => {
		const rows = buildSpecRows([
			attr('diameter', 'Діаметр', '1.75 мм'),
			attr('polymer', 'Тип пластику', 'PLA')
		])

		expect(rows.map(r => r.key)).toEqual(['polymer', 'diameter'])
	})

	/**
	 * `derive-material-taxonomy.js` makes dimensions multi-valued on purpose — `PLA Silk
	 * Rainbow` yields two `finish` entries. Printed straight that is two rows claiming to be the
	 * same row, sharing a React key.
	 */
	it('merges a multi-valued dimension into one row', () => {
		const rows = buildSpecRows([
			attr('finish', 'Ефект поверхні', 'Silk'),
			attr('finish', 'Ефект поверхні', 'Rainbow')
		])

		expect(rows).toHaveLength(1)
		expect(rows[0].value).toBe('Silk, Rainbow')
	})

	it('does not repeat a value stored twice', () => {
		const rows = buildSpecRows([
			attr('finish', 'Ефект поверхні', 'Silk'),
			attr('finish', 'Ефект поверхні', 'Silk')
		])

		expect(rows[0].value).toBe('Silk')
	})

	/** `material` is the string the four dimensions were derived from — printing both says it twice. */
	it('drops the superseded material row', () => {
		const rows = buildSpecRows([
			attr('material', 'Матеріал', 'PLA Silk'),
			attr('polymer', 'Тип пластику', 'PLA'),
			attr('finish', 'Ефект поверхні', 'Silk')
		])

		expect(rows.map(r => r.key)).toEqual(['polymer', 'finish'])
	})

	/** The brand is the chip above the H1; the mock's table has no «Виробник» row. */
	it('drops the manufacturer row it would repeat from the brand chip', () => {
		const rows = buildSpecRows([
			attr('vyrobnyk', 'Виробник', 'Kingroon'),
			attr('polymer', 'Тип пластику', 'PLA')
		])

		expect(rows.map(r => r.key)).toEqual(['polymer'])
	})

	/** The weight is stored in kilograms as a bare `1`; the unit comes from the category. */
	it('prints the unit the attribute carries', () => {
		const rows = buildSpecRows([{ k: 'vaha', l: 'Вага', v: 1, unit: 'кг' }])

		expect(rows[0].value).toBe('1 кг')
	})

	it('drops a unit-bearing dimension whose unit the payload does not carry yet', () => {
		const rows = buildSpecRows([
			{ k: 'vaha', l: 'Вага', v: 1 },
			attr('polymer', 'Тип пластику', 'PLA')
		])

		// «Вага | 1» reads as one gram, one spool or one metre — a bare number is not a fact.
		expect(rows.map(r => r.key)).toEqual(['polymer'])
	})

	it('keeps a unit-bearing dimension whose value spells the unit out itself', () => {
		const rows = buildSpecRows([attr('vaha', 'Вага', '1000 г')])

		expect(rows[0].value).toBe('1000 г')
	})

	it('appends the unit to every value of a multi-valued dimension', () => {
		const rows = buildSpecRows([
			{ k: 'diameter', l: 'Діаметр', v: '1.75', unit: 'мм' },
			{ k: 'diameter', l: 'Діаметр', v: '2.85', unit: 'мм' }
		])

		expect(rows[0].value).toBe('1.75 мм, 2.85 мм')
	})

	it('prints the value the shopper chose on the variant axis, not the stored one', () => {
		const rows = buildSpecRows([attr('color', 'Колір', 'Black')], { color: 'Чорний (Black)' })

		expect(rows[0].value).toBe('Чорний (Black)')
	})

	it('sets a refill apart from the rest of the table', () => {
		const rows = buildSpecRows([
			attr('spool_included', 'Котушка в комплекті', 'Ні (рефіл)'),
			attr('polymer', 'Тип пластику', 'PETG')
		])

		expect(rows[0].emphasised).toBe(true)
		expect(rows[1].emphasised).toBe(false)
	})

	it('is empty for a product with no attributes', () => {
		expect(buildSpecRows([])).toEqual([])
	})
})
