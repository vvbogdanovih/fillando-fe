import { beforeEach, describe, expect, it, vi } from 'vitest'

const analytics = vi.hoisted(() => ({ GOOGLE_ANALYTICS_ID: 'G-TEST' }))

vi.mock('@/common/constants/analytics.constants', () => analytics)
vi.mock('./gtag', () => ({ gtag: vi.fn() }))

import { gtag } from './gtag'
import {
	claimPurchaseTracking,
	trackAddToCart,
	trackBeginCheckout,
	trackPurchase,
	trackViewItem
} from './ga4-events'

const item = { item_id: 'FL-000342', item_name: 'Sunlu PLA Silk — Gold', price: 549 }

describe('ga4-events', () => {
	beforeEach(() => {
		vi.mocked(gtag).mockClear()
		analytics.GOOGLE_ANALYTICS_ID = 'G-TEST'
	})

	it('view_item carries the item once with quantity 1', () => {
		trackViewItem(item)
		expect(gtag).toHaveBeenCalledWith('event', 'view_item', {
			currency: 'UAH',
			value: 549,
			items: [{ ...item, quantity: 1 }]
		})
	})

	it('add_to_cart multiplies the value by the quantity', () => {
		trackAddToCart({ ...item, quantity: 3 })
		expect(gtag).toHaveBeenCalledWith('event', 'add_to_cart', {
			currency: 'UAH',
			value: 1647,
			items: [{ ...item, quantity: 3 }]
		})
	})

	it('begin_checkout passes the cart lines through', () => {
		trackBeginCheckout({ value: 1098, items: [{ ...item, quantity: 2 }] })
		expect(gtag).toHaveBeenCalledWith('event', 'begin_checkout', {
			currency: 'UAH',
			value: 1098,
			items: [{ ...item, quantity: 2 }]
		})
	})

	it('purchase is aggregated and drops value when it is unknown', () => {
		trackPurchase({ transaction_id: 'FO-0000123', value: 1500 })
		trackPurchase({ transaction_id: 'FO-0000124' })
		expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'purchase', {
			transaction_id: 'FO-0000123',
			currency: 'UAH',
			value: 1500
		})
		expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'purchase', {
			transaction_id: 'FO-0000124',
			currency: 'UAH'
		})
	})

	it('does nothing until a GA4 property id is configured', () => {
		analytics.GOOGLE_ANALYTICS_ID = ''
		trackViewItem(item)
		trackPurchase({ transaction_id: 'x' })
		expect(gtag).not.toHaveBeenCalled()
	})

	describe('claimPurchaseTracking (F12)', () => {
		beforeEach(() => window.localStorage.clear())

		it('claims an order once per browser and keeps the list bounded', () => {
			expect(claimPurchaseTracking('FO-0000001')).toBe(true)
			expect(claimPurchaseTracking('FO-0000001')).toBe(false)
			for (let n = 2; n <= 60; n++) claimPurchaseTracking(`FO-${n}`)
			const stored = JSON.parse(window.localStorage.getItem('fillando-tracked-orders')!)
			expect(stored).toHaveLength(50)
			// The oldest fell out of the window; a recent one is still remembered.
			expect(claimPurchaseTracking('FO-60')).toBe(false)
		})

		it('reports when storage is broken or throws, so a purchase is never lost', () => {
			window.localStorage.setItem('fillando-tracked-orders', '{not json')
			expect(claimPurchaseTracking('FO-0000002')).toBe(true)
			const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
				throw Error('blocked')
			})
			expect(claimPurchaseTracking('FO-0000002')).toBe(true)
			getItem.mockRestore()
		})
	})
})
