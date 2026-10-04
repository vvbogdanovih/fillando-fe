import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PriceTag } from './PriceTag'

afterEach(cleanup)

describe('PriceTag', () => {
	it('prints one figure and no strike without a promotion', () => {
		const { container } = render(<PriceTag item={{ price: 419 }} />)
		expect(screen.getByText('419 ₴')).toBeInTheDocument()
		expect(container.querySelector('s')).toBeNull()
		expect(screen.queryByText('Стара ціна:')).not.toBeInTheDocument()
	})

	it('prints the sale price and strikes the regular one, each named for a screen reader', () => {
		const { container } = render(
			<PriceTag
				item={{ price: 419, sale_price: 356, promo_percent: 15, promo_ends_at: null }}
				priceClassName='text-3xl'
			/>
		)
		expect(screen.getByText('356 ₴')).toHaveClass('text-3xl')
		const struck = container.querySelector('s')
		expect(struck).not.toBeNull()
		expect(struck).toHaveTextContent('419 ₴')
		expect(screen.getByText('Ціна зі знижкою:')).toHaveClass('sr-only')
		expect(screen.getByText('Стара ціна:')).toHaveClass('sr-only')
	})
})
