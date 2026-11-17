import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { StoreStrip } from './StoreStrip'

afterEach(cleanup)

it('prints the «Вітрина» lines and the phone as a call link', () => {
	render(<StoreStrip items={['Доставка 1–3 дні', 'Консультація 7 днів на тиждень']} />)
	expect(screen.getByText('Доставка 1–3 дні')).toBeInTheDocument()
	expect(screen.getByText('Консультація 7 днів на тиждень')).toBeInTheDocument()
	expect(screen.getByRole('link', { name: '+38 098 605 01 87' })).toHaveAttribute(
		'href',
		'tel:+380986050187'
	)
})

it('is not there without lines', () => {
	const { container } = render(<StoreStrip items={[]} />)
	expect(container).toBeEmptyDOMElement()
})
