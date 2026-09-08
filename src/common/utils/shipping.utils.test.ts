import { describe, expect, it } from 'vitest'
import {
	buildShippingDetails,
	estimateShipping,
	SHIPPING_RATE_TABLE,
	type ShippingQuote,
	type ShippingZone
} from './shipping.utils'

/** Narrows to the priced state so a test can read a rate without repeating the guard. */
const quoteFor = (weightG: number | null | undefined, zone?: ShippingZone): ShippingQuote => {
	const estimate = zone ? estimateShipping(weightG, zone) : estimateShipping(weightG)
	if (estimate.kind !== 'quoted') throw new Error(`expected a quote, got ${estimate.kind}`)
	return estimate
}

describe('estimateShipping', () => {
	it('picks the first tier the weight fits into', () => {
		expect(quoteFor(1220).max_weight_g).toBe(2000)
		expect(quoteFor(2000).max_weight_g).toBe(2000)
		expect(quoteFor(2001).max_weight_g).toBe(10000)
	})

	it('quotes the country-wide zone by default and the city zone on request', () => {
		const tier = SHIPPING_RATE_TABLE.tiers[0]
		expect(quoteFor(500).rate_uah).toBe(tier.ukraine_uah)
		expect(quoteFor(500, 'city').rate_uah).toBe(tier.city_uah)
	})

	/** 0 is what an unfilled weight field backfills to — quoting the cheapest tier for it lied. */
	it.each([null, undefined, -1, 0, Number.NaN])('reports an unknown weight for %p', weight => {
		expect(estimateShipping(weight)).toEqual({
			kind: 'weight_unknown',
			transit_days: { min: 1, max: 3 }
		})
	})

	it('says a parcel is over the table instead of calling its weight unknown', () => {
		expect(estimateShipping(10001)).toEqual({
			kind: 'above_table',
			over_weight_g: 10000,
			transit_days: { min: 1, max: 3 }
		})
	})

	it('carries the transit window in all three states', () => {
		const states = [estimateShipping(1220), estimateShipping(null), estimateShipping(10001)]
		expect(states.map(s => s.kind)).toEqual(['quoted', 'weight_unknown', 'above_table'])
		for (const state of states) expect(state.transit_days).toEqual({ min: 1, max: 3 })
	})
})

describe('buildShippingDetails', () => {
	it('omits the block entirely when there is no estimate', () => {
		expect(buildShippingDetails(null)).toBeUndefined()
	})

	/** Both are unpriced states, and an invented rate is what gets a listing disapproved. */
	it.each([0, 10001])('omits the block for the unpriced weight %p', weight => {
		expect(buildShippingDetails(weight)).toBeUndefined()
	})

	it('emits schema.org OfferShippingDetails for Ukraine', () => {
		const details = buildShippingDetails(1220)
		expect(details).toMatchObject({
			'@type': 'OfferShippingDetails',
			shippingRate: { currency: 'UAH', value: SHIPPING_RATE_TABLE.tiers[0].ukraine_uah },
			shippingDestination: { addressCountry: 'UA' }
		})
	})
})
