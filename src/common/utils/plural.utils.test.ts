import { describe, expect, it } from 'vitest'
import { pluralUk, productsCount } from './plural.utils'

describe('pluralUk', () => {
	it.each([
		[1, 'товар'],
		[2, 'товари'],
		[3, 'товари'],
		[4, 'товари'],
		[5, 'товарів'],
		[10, 'товарів'],
		// The teens are the trap: 11–14 take the many form despite ending in 1–4.
		[11, 'товарів'],
		[12, 'товарів'],
		[14, 'товарів'],
		[21, 'товар'],
		[22, 'товари'],
		[25, 'товарів'],
		[100, 'товарів'],
		[101, 'товар'],
		[111, 'товарів'],
		[0, 'товарів']
	])('%i takes "%s"', (count, expected) => {
		expect(pluralUk(count, 'товар', 'товари', 'товарів')).toBe(expected)
	})
})

describe('productsCount', () => {
	it.each([
		[1, '1 товар'],
		[26, '26 товарів'],
		[42, '42 товари'],
		[156, '156 товарів']
	])('%i reads "%s"', (count, expected) => {
		expect(productsCount(count)).toBe(expected)
	})
})
