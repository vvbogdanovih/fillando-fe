import { describe, expect, it } from 'vitest'
import { productPageTitle, productDisplayName } from './product-title.utils'
describe('productPageTitle', () => {
	it('uses actual category without inventing diameter', () => {
		expect(productPageTitle('Kingroon PLA', 'Чорний', 'Філамент')).toBe(
			'Kingroon PLA — Філамент — Чорний'
		)
		expect(productPageTitle('Електроковдра', '150 × 180 см', 'Електроковдри')).toBe(
			'Електроковдра — Електроковдри — 150 × 180 см'
		)
		expect(productPageTitle('AVR', '63 А', 'Автомати вводу резерву')).not.toMatch(
			/філамент|1,75/
		)
	})
	it('retains variant suffix and avoids repeated category text', () => {
		expect(productPageTitle('Філамент Kingroon 2,85 мм', 'Чорний', 'Філамент')).toBe(
			'Філамент Kingroon 2,85 мм — Чорний'
		)
		expect(productPageTitle('AVR', null)).toBe('AVR')
		expect(productPageTitle('Ковдра', 'XL')).toBe('Ковдра — XL')
	})
})

describe('productDisplayName', () => {
	it('prints the name as written, then the variation', () => {
		expect(productDisplayName('Kingroon PLA', 'Чорний (Black)')).toBe(
			'Kingroon PLA — Чорний (Black)'
		)
		expect(productDisplayName('АВР', '32 А')).toBe('АВР — 32 А')
	})

	it('adds nothing without a variation', () => {
		expect(productDisplayName('Соло-котушка Kingroon')).toBe('Соло-котушка Kingroon')
		expect(productDisplayName('Ковдра', null)).toBe('Ковдра')
	})
})
