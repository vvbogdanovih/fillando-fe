import { describe, expect, it } from 'vitest'
import {
	buildPriceListPayload,
	layoutAttributes,
	parseAttachmentFilename,
	type AttributeField,
	type PriceListFormState,
	type RequiredAttributeLike
} from './products.utils'

const baseState: PriceListFormState = {
	categoryIds: [],
	allCategories: true,
	inStockOnly: false,
	tier1Percent: '10',
	tier2Percent: '15',
	orientation: 'portrait'
}

describe('buildPriceListPayload', () => {
	it('omits category_ids entirely when all categories are selected', () => {
		const payload = buildPriceListPayload({ ...baseState, categoryIds: ['a', 'b'] })

		expect(payload).toEqual({
			in_stock_only: false,
			tier1_percent: 10,
			tier2_percent: 15,
			orientation: 'portrait'
		})
		expect('category_ids' in payload).toBe(false)
	})

	it('sends the selected category ids when the selection is partial', () => {
		const payload = buildPriceListPayload({
			...baseState,
			allCategories: false,
			categoryIds: ['cat-1', 'cat-2'],
			inStockOnly: true
		})

		expect(payload).toEqual({
			in_stock_only: true,
			tier1_percent: 10,
			tier2_percent: 15,
			orientation: 'portrait',
			category_ids: ['cat-1', 'cat-2']
		})
	})

	it('passes the chosen page orientation through', () => {
		expect(buildPriceListPayload({ ...baseState, orientation: 'landscape' }).orientation).toBe(
			'landscape'
		)
	})

	it('converts the percent strings to numbers', () => {
		const payload = buildPriceListPayload({
			...baseState,
			tier1Percent: '7',
			tier2Percent: '12.5'
		})

		expect(payload.tier1_percent).toBe(7)
		expect(payload.tier2_percent).toBe(12.5)
	})
})

describe('parseAttachmentFilename', () => {
	it('reads a quoted filename', () => {
		const header = 'attachment; filename="price-list-2026-08-20.pdf"'
		expect(parseAttachmentFilename(header, 'fallback.pdf')).toBe('price-list-2026-08-20.pdf')
	})

	it('reads an unquoted filename', () => {
		expect(parseAttachmentFilename('attachment; filename=report.pdf', 'fallback.pdf')).toBe(
			'report.pdf'
		)
	})

	it('prefers the RFC 5987 form when present', () => {
		const header =
			'attachment; filename="fallback.pdf"; filename*=UTF-8\'\'%D0%BF%D1%80%D0%B0%D0%B9%D1%81.pdf'
		expect(parseAttachmentFilename(header, 'fallback.pdf')).toBe('прайс.pdf')
	})

	it('falls back when the header is missing or unparseable', () => {
		expect(parseAttachmentFilename(undefined, 'fallback.pdf')).toBe('fallback.pdf')
		expect(parseAttachmentFilename('attachment', 'fallback.pdf')).toBe('fallback.pdf')
	})
})

describe('layoutAttributes', () => {
	const required: RequiredAttributeLike[] = [
		{ key: 'vyrobnyk', label: 'Виробник', unit: null },
		{ key: 'series', label: 'Серія', unit: null }
	]

	const field = (k: string, l: string, v: string): AttributeField => ({ k, l, v })

	it('pairs each required attribute with its own row, whatever the order', () => {
		const fields = [field('series', 'Серія', 'Plus'), field('vyrobnyk', 'Виробник', 'Bambu')]

		const { required: rows } = layoutAttributes(required, fields)

		expect(rows.map(r => [r.attr.key, r.index, r.value])).toEqual([
			['vyrobnyk', 1, 'Bambu'],
			['series', 0, 'Plus']
		])
	})

	it('reports a required attribute the product does not carry yet', () => {
		// This is the state Plan-0004 task 17 creates: the category gains dimensions that
		// existing products have never stored.
		const fields = [field('vyrobnyk', 'Виробник', 'Bambu')]

		const { required: rows } = layoutAttributes(required, fields)

		expect(rows[1]).toEqual({ attr: required[1], index: null, value: '' })
	})

	it('never points two required attributes at the same row', () => {
		// The positional version did exactly this once the lists differed in length, so typing in one
		// input overwrote another attribute.
		const fields = [field('kolir', 'Колір', 'Чорний'), field('vyrobnyk', 'Виробник', 'Bambu')]

		const indexes = layoutAttributes(required, fields)
			.required.map(r => r.index)
			.filter((i): i is number => i !== null)

		expect(new Set(indexes).size).toBe(indexes.length)
	})

	it('keeps custom attributes visible even when they come before the required ones', () => {
		// `fields.slice(requiredCount)` hid them whenever the counts disagreed.
		const fields = [field('kolir', 'Колір', 'Чорний'), field('vyrobnyk', 'Виробник', 'Bambu')]

		const { custom } = layoutAttributes(required, fields)

		expect(custom).toEqual([{ field: fields[0], index: 0 }])
	})

	it('gives every custom row its real index, so removal deletes the right one', () => {
		const fields = [
			field('vyrobnyk', 'Виробник', 'Bambu'),
			field('kolir', 'Колір', 'Чорний'),
			field('series', 'Серія', 'Plus'),
			field('tverdist', 'Твердість', '95A')
		]

		const { custom } = layoutAttributes(required, fields)

		expect(custom.map(c => [c.field.k, c.index])).toEqual([
			['kolir', 1],
			['tverdist', 3]
		])
	})

	it('matches on the key the API derives, not on the stored key', () => {
		// `Серія` maps to `series` through ATTR_KEY_OVERRIDES; a row still carrying the old
		// transliterated key is a custom attribute until the migration renames it.
		const fields = [field('seriia', 'Серія', 'Plus')]

		const layout = layoutAttributes(required, fields)

		expect(layout.required[1].index).toBeNull()
		expect(layout.custom).toHaveLength(1)
	})

	it.each([
		['no required attributes', [] as RequiredAttributeLike[], [] as AttributeField[]],
		['no fields', [{ key: 'vyrobnyk', label: 'Виробник', unit: null }], [] as AttributeField[]]
	])('handles %s', (_case, attrs, fields) => {
		expect(() => layoutAttributes(attrs, fields)).not.toThrow()
	})

	it('renders a missing value as an empty string rather than undefined', () => {
		const fields = [{ k: 'vyrobnyk', l: 'Виробник', v: '' } as AttributeField]

		expect(layoutAttributes(required, fields).required[0].value).toBe('')
	})
})
