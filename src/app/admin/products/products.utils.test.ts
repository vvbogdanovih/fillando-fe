import { describe, expect, it } from 'vitest'
import {
	buildPriceListPayload,
	parseAttachmentFilename,
	type PriceListFormState
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
