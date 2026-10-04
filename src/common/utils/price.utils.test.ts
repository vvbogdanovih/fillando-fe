import { describe, expect, it } from 'vitest'
import {
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
