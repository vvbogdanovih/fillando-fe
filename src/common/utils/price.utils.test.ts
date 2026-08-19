import { describe, expect, it } from 'vitest'
import { formatPriceAsOf, formatUah } from './price.utils'

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
