import { describe, expect, it } from 'vitest'
import { buildOrdersListSearch, parseOrdersListParams } from './orders.utils'

const parse = (query: string) => parseOrdersListParams(new URLSearchParams(query))

describe('admin orders list — state in the URL', () => {
	it('reads page, size and filters back from the address', () => {
		expect(parse('page=3&limit=50&order_status=NEW&payment_status=PAID')).toEqual({
			page: 3,
			limit: 50,
			orderStatus: 'NEW',
			paymentStatus: 'PAID'
		})
	})

	it('falls back to the defaults for an empty address', () => {
		expect(parse('')).toEqual({
			page: 1,
			limit: 20,
			orderStatus: 'all',
			paymentStatus: 'all'
		})
	})

	it.each(['page=0', 'page=-2', 'page=abc', 'page=2.5'])('ignores a broken %s', query => {
		expect(parse(query).page).toBe(1)
	})

	it('never sends the API a size or a status the list does not offer', () => {
		expect(parse('limit=10000&order_status=HACKED&payment_status=new')).toMatchObject({
			limit: 20,
			orderStatus: 'all',
			paymentStatus: 'all'
		})
	})

	it('leaves the defaults out, so the first page is the bare address', () => {
		expect(
			buildOrdersListSearch({ page: 1, limit: 20, orderStatus: 'all', paymentStatus: 'all' })
		).toBe('')
	})

	it('round-trips through the address', () => {
		const params = {
			page: 4,
			limit: 10,
			orderStatus: 'SHIPPED',
			paymentStatus: 'PENDING'
		} as const
		expect(parse(buildOrdersListSearch(params).slice(1))).toEqual(params)
	})
})
