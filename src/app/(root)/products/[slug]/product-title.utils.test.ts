import { describe, expect, it } from 'vitest'
import { productPageTitle } from './product-title.utils'

describe('productPageTitle', () => {
	it('adds the category word and diameter to a short name', () => {
		expect(productPageTitle('Kingroon PLA Silk Rainbow', 'Золотий (Gold)')).toBe(
			'Kingroon PLA Silk Rainbow — Золотий (Gold) — філамент 1,75 мм'
		)
	})

	it('says nothing twice for a long name that still carries them', () => {
		expect(
			productPageTitle(
				'Філамент (пластик для 3D принтера) Kingroon PLA 1,75 мм 1 кг',
				'Чорний'
			)
		).toBe('Філамент (пластик для 3D принтера) Kingroon PLA 1,75 мм 1 кг — Чорний')
	})

	it('keeps a product that names its own diameter as it is', () => {
		expect(productPageTitle('Kingroon PLA 2,85 мм', null)).toBe('Kingroon PLA 2,85 мм')
	})

	it('works without a variant value', () => {
		expect(productPageTitle('Kingroon TPU', null)).toBe('Kingroon TPU — філамент 1,75 мм')
	})
})
