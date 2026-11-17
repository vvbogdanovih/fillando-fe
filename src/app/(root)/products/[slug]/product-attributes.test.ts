import { describe, expect, it } from 'vitest'
import { buildSpecRows, type ProductAttribute } from './product-attributes'

const attr = (k: string, l: string, v: string): ProductAttribute => ({ k, l, v })

describe('buildSpecRows', () => {
	/**
	 * The order is the backend's (owner, 2026-11-05): a v2 page arrives ordered by the category's
	 * definitions, a v1 page in its stored order. The storefront has no order of its own.
	 */
	it('keeps the rows in the order they arrive', () => {
		const rows = buildSpecRows([
			attr('series', 'Серія', 'Basic'),
			attr('polymer', 'Тип пластику', 'PLA'),
			attr('spool_included', 'Котушка в комплекті', 'Так'),
			attr('finish', 'Ефект поверхні', 'Silk')
		])

		expect(rows.map(r => r.key)).toEqual(['series', 'polymer', 'spool_included', 'finish'])
	})

	/**
	 * Visibility is the definition's «У таблиці характеристик на сторінці товару», applied by the
	 * backend: whatever arrives is printed, `material` and «Виробник» included.
	 */
	it('hides nothing the backend sends', () => {
		const rows = buildSpecRows([
			attr('material', 'Матеріал', 'PLA Silk'),
			attr('vyrobnyk', 'Виробник', 'Kingroon'),
			attr('polymer', 'Тип пластику', 'PLA')
		])

		expect(rows.map(r => r.key)).toEqual(['material', 'vyrobnyk', 'polymer'])
	})

	it('emphasises no value', () => {
		const rows = buildSpecRows([attr('spool_included', 'Котушка в комплекті', 'Ні (рефіл)')])

		expect(rows).toEqual([
			{ key: 'spool_included', label: 'Котушка в комплекті', value: 'Ні (рефіл)' }
		])
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

	/** The weight is stored in kilograms as a bare `1`; the unit comes from the category. */
	it('prints the unit the attribute carries', () => {
		const rows = buildSpecRows([{ k: 'vaha', l: 'Вага', v: 1, unit: 'кг' }])

		expect(rows[0].value).toBe('1 кг')
	})

	/**
	 * The unit belongs to the characteristic's settings; there is no rule hiding a bare number
	 * any more (retired 2026-11-05 — every numeric characteristic of the shop has its unit).
	 */
	it('prints a value without a unit as stored', () => {
		const rows = buildSpecRows([{ k: 'vaha', l: 'Вага', v: 1 }])

		expect(rows[0].value).toBe('1')
	})

	it('keeps a value that spells the unit out itself', () => {
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

	it('is empty for a product with no attributes', () => {
		expect(buildSpecRows([])).toEqual([])
	})

	it('prints a non-filament category the same way', () => {
		const rows = buildSpecRows([
			{ k: 'material', l: 'Матеріал', v: 'Бавовна' },
			{ k: 'power', l: 'Потужність', v: 60, unit: 'Вт' }
		])
		expect(rows.map(row => row.key)).toEqual(['material', 'power'])
		expect(rows[1].value).toBe('60 Вт')
	})
})
