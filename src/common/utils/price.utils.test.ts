import { describe, expect, it } from 'vitest'
import {
	couponDiscountAmount,
	effectivePrice,
	formatPriceAsOf,
	formatPromoEndsAt,
	formatUah,
	isPromoActive,
	promoPercentLabel
} from './price.utils'

/** `uk-UA` groups thousands with a non-breaking space, not a plain one. */
const NBSP = '\u00a0'

describe('formatUah', () => {
	it('groups thousands and appends the currency', () => {
		expect(formatUah(2610)).toBe(`2${NBSP}610 ₴`)
	})

	it('leaves small amounts alone', () => {
		expect(formatUah(145)).toBe('145 ₴')
	})
})

describe('formatPriceAsOf', () => {
	it('renders the day and month', () => {
		expect(formatPriceAsOf('2026-08-14T09:30:00.000Z')).toBe('ціна на 14.08')
	})

	it('accepts a Date', () => {
		expect(formatPriceAsOf(new Date('2026-01-05T00:00:00.000Z'))).toBe('ціна на 05.01')
	})

	it.each([null, undefined, '', 'not-a-date'])('returns null for %p', value => {
		expect(formatPriceAsOf(value)).toBeNull()
	})
})

describe('promotions (TD-0012)', () => {
	const NOW = Date.parse('2026-10-04T12:00:00.000Z')
	const onSale = { price: 649, sale_price: 552, promo_percent: 15, promo_ends_at: null }

	it('is on when the server sent a lower sale price', () => {
		expect(isPromoActive(onSale, NOW)).toBe(true)
		expect(effectivePrice(onSale, NOW)).toBe(552)
		expect(promoPercentLabel(onSale, NOW)).toBe('−15 %')
	})

	it('is off without a sale price, with a sale price that is not lower, or from an older backend', () => {
		expect(isPromoActive({ price: 649 }, NOW)).toBe(false)
		expect(isPromoActive({ price: 649, sale_price: null }, NOW)).toBe(false)
		expect(isPromoActive({ price: 649, sale_price: 649 }, NOW)).toBe(false)
		expect(effectivePrice({ price: 649 }, NOW)).toBe(649)
		expect(promoPercentLabel({ price: 649 }, NOW)).toBeNull()
	})

	it('runs out on its end date — a guest line captured before it falls back to the regular price', () => {
		const dated = { ...onSale, promo_ends_at: '2026-11-01T00:00:00.000Z' }
		expect(isPromoActive(dated, NOW)).toBe(true)
		expect(isPromoActive(dated, Date.parse('2026-11-01T00:00:00.000Z'))).toBe(false)
		expect(effectivePrice(dated, Date.parse('2026-12-01T00:00:00.000Z'))).toBe(649)
	})

	it('trusts the server without a clock, so SSR and hydration print the same price', () => {
		// The server sent a sale price together with a date that is already past by this
		// machine's clock: the trio is still the server's word, not the browser's to re-judge.
		const stale = { ...onSale, promo_ends_at: '2020-01-01T00:00:00.000Z' }
		expect(isPromoActive(stale)).toBe(true)
		expect(effectivePrice(stale)).toBe(552)
		expect(promoPercentLabel(stale)).toBe('−15 %')
	})

	it("formats the end date for the badge and the page in the shop's zone, not the server's", () => {
		expect(formatPromoEndsAt('2026-11-01T10:00:00.000Z')).toBe('до 01.11')
		// 22:30 UTC is already 2 November in Kyiv — the day the admin entered.
		expect(formatPromoEndsAt('2026-11-01T22:30:00.000Z')).toBe('до 02.11')
		expect(formatPromoEndsAt(null)).toBeNull()
		expect(formatPromoEndsAt('nope')).toBeNull()
	})
})

// The same figures live in the backend's coupon-pricing.spec.ts — the preview must match the order.
describe('couponDiscountAmount (TD-0012, revised 2026-10-05)', () => {
	const plain = { price: 500, listPrice: 500, quantity: 1 }
	// 600 at −10 %: sale 540, the promotion already saves 60 a unit.
	const onSale = { price: 540, listPrice: 600, quantity: 2 }

	it('takes the full percent off a line without a promotion', () => {
		expect(couponDiscountAmount([plain], 10)).toBe(50)
	})

	it('adds nothing to a promo line the coupon does not beat', () => {
		expect(couponDiscountAmount([onSale], 10)).toBe(0)
		expect(couponDiscountAmount([onSale], 5)).toBe(0)
	})

	it('lifts a promo line to the coupon percent of the regular price when the coupon is larger', () => {
		// 15 % of 2 × 600 is 180; the sale already gave 120, so the coupon adds 60.
		expect(couponDiscountAmount([onSale], 15)).toBe(60)
	})

	it('sums the lines: each one keeps the larger of its two discounts', () => {
		expect(couponDiscountAmount([onSale, plain], 10)).toBe(50)
		expect(couponDiscountAmount([onSale, plain], 15)).toBe(135)
	})

	it('measures a sale rounded to whole hryvnias from the regular price, so the line ends at exactly the coupon percent', () => {
		expect(couponDiscountAmount([{ price: 539, listPrice: 599, quantity: 1 }], 15)).toBe(29.85)
	})

	it('answers two decimals and zero for an empty cart', () => {
		expect(couponDiscountAmount([{ price: 333, listPrice: 333, quantity: 3 }], 7)).toBe(69.93)
		expect(couponDiscountAmount([], 15)).toBe(0)
	})
})
