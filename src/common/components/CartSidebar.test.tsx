import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from '@/common/store/useCartStore'
import { CartSidebar } from './CartSidebar'

/**
 * The empty cart leads to the whole catalogue, not to one category (Plan-0010 F11, P07): the
 * shop is no longer filament only, and `/catalog` is the common entry.
 */
afterEach(cleanup)
beforeEach(() => {
	useCartStore.setState({ isOpen: true, items: [], guestItems: [] })
})

describe('CartSidebar', () => {
	it('sends an empty cart to the whole catalogue', () => {
		render(<CartSidebar />)
		expect(screen.getByText('Кошик порожній')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Перейти до каталогу' })).toHaveAttribute(
			'href',
			'/catalog'
		)
	})
})
