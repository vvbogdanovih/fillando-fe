import { describe, expect, it } from 'vitest'
import { previewSalePrice, promoStateOf } from './products.schema'

const NOW = Date.parse('2026-10-04T12:00:00.000Z')

describe('previewSalePrice', () => {
	it('rounds half up to whole hryvnias, like the backend', () => {
		expect(previewSalePrice(250, 15)).toBe(213) // 212.5
		expect(previewSalePrice(649, 15)).toBe(552) // 551.65
		expect(previewSalePrice(1000, 90)).toBe(100)
	})
})

describe('promoStateOf (TD-0012)', () => {
	it('is none without a percent', () => {
		expect(promoStateOf({ price: 500 }, NOW)).toBe('none')
		expect(promoStateOf({ price: 500, promo_percent: null }, NOW)).toBe('none')
	})

	it('is live with a percent and no date, or a date still ahead', () => {
		expect(promoStateOf({ price: 500, promo_percent: 10 }, NOW)).toBe('live')
		expect(
			promoStateOf(
				{ price: 500, promo_percent: 10, promo_ends_at: '2099-01-01T00:00:00.000Z' },
				NOW
			)
		).toBe('live')
	})

	it('is ended once the date is reached — the backend keeps the fields, the shop gives nothing', () => {
		expect(
			promoStateOf(
				{ price: 500, promo_percent: 10, promo_ends_at: '2026-10-04T12:00:00.000Z' },
				NOW
			)
		).toBe('ended')
	})

	it('is none when the percent rounds to no saving or to nothing — exactly what the backend derives', () => {
		// 1 % off 40 ₴ rounds back to 40 ₴: the table must not strike a price through for it.
		expect(promoStateOf({ price: 40, promo_percent: 1 }, NOW)).toBe('none')
		// 90 % off 3 ₴ rounds to 0 ₴: nothing is sold for nothing.
		expect(promoStateOf({ price: 3, promo_percent: 90 }, NOW)).toBe('none')
		// A variant without a price has nothing to discount.
		expect(promoStateOf({ price: 0, promo_percent: 50 }, NOW)).toBe('none')
		// …and the no-saving case wins over «ended»: there never was a sale to end.
		expect(
			promoStateOf(
				{ price: 40, promo_percent: 1, promo_ends_at: '2020-01-01T00:00:00.000Z' },
				NOW
			)
		).toBe('none')
	})
})
