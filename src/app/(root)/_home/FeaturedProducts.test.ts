import { describe, expect, it } from 'vitest'
import { beyondFullRows } from './FeaturedProducts'

const hidden = (count: number, variant: string) =>
	Array.from({ length: count }, (_, index) => beyondFullRows(index, count)).filter(classes =>
		classes.split(' ').includes(variant)
	).length

describe('beyondFullRows', () => {
	it('shows a strip of 8 as one full row of 6 on a computer and two rows of 4 or four of 2 below', () => {
		expect(hidden(8, 'lg:hidden')).toBe(2)
		expect(hidden(8, 'md:max-lg:hidden')).toBe(0)
		expect(hidden(8, 'max-md:hidden')).toBe(0)
	})

	it('trims the last partial row at every width', () => {
		expect(hidden(7, 'lg:hidden')).toBe(1)
		expect(hidden(7, 'md:max-lg:hidden')).toBe(3)
		expect(hidden(7, 'max-md:hidden')).toBe(1)
		// The hidden cards are always the last ones.
		expect(beyondFullRows(6, 7).split(' ')).toContain('lg:hidden')
		expect(beyondFullRows(5, 7).split(' ')).not.toContain('lg:hidden')
	})

	it('shows every card when there are fewer than one row', () => {
		expect(hidden(3, 'lg:hidden')).toBe(0)
		expect(hidden(3, 'md:max-lg:hidden')).toBe(0)
		expect(hidden(3, 'max-md:hidden')).toBe(1)
		expect(hidden(1, 'max-md:hidden')).toBe(0)
	})
})
