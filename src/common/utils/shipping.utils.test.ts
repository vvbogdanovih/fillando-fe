import { describe, expect, it } from 'vitest'
import { buildShippingDetails, estimateShipping, SHIPPING_RATE_TABLE } from './shipping.utils'

describe('estimateShipping', () => {
	it('picks the first tier the weight fits into', () => {
		expect(estimateShipping(1220)?.max_weight_g).toBe(2000)
		expect(estimateShipping(2000)?.max_weight_g).toBe(2000)
		expect(estimateShipping(2001)?.max_weight_g).toBe(10000)
	})

	it('quotes the country-wide zone by default and the city zone on request', () => {
		const tier = SHIPPING_RATE_TABLE.tiers[0]
		expect(estimateShipping(500)?.rate_uah).toBe(tier.ukraine_uah)
		expect(estimateShipping(500, 'city')?.rate_uah).toBe(tier.city_uah)
	})

	it.each([null, undefined, -1, Number.NaN, 10001])('returns null for %p', weight => {
		expect(estimateShipping(weight)).toBeNull()
	})
})

describe('buildShippingDetails', () => {
	it('omits the block entirely when there is no estimate', () => {
		expect(buildShippingDetails(null)).toBeUndefined()
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
