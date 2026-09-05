import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImgHTMLAttributes } from 'react'
import { PopularLandings, shortLabel, type PopularLanding } from './PopularLandings'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))

const tile = (over: Partial<PopularLanding> & Pick<PopularLanding, 'slug' | 'h1'>) =>
	({ image: null, product_count: 12, ...over }) as PopularLanding

const renderTiles = (landings: PopularLanding[]) =>
	render(<PopularLandings categorySlug='filament' categoryName='Філамент' landings={landings} />)

/** The 14 landings `seed-landings.js` actually creates, against the category they live in. */
describe('shortLabel', () => {
	it.each([
		['PLA філамент', 'PLA'],
		['PETG філамент', 'PETG'],
		['TPU (Flex) філамент', 'TPU (Flex)'],
		['PLA Silk філамент', 'PLA Silk'],
		['PLA-CF філамент', 'PLA-CF'],
		// Nothing to strip at the end: printed whole rather than cut somewhere arbitrary.
		['Філамент, що світиться', 'Філамент, що світиться'],
		['Філамент під дерево', 'Філамент під дерево'],
		['ABS пластик для 3D-друку', 'ABS пластик для 3D-друку']
	])('«%s» becomes «%s»', (h1, expected) => {
		expect(shortLabel(h1, 'Філамент')).toBe(expected)
	})

	it('never returns an empty label, even when the H1 is only the category name', () => {
		expect(shortLabel('Філамент', 'Філамент')).toBe('Філамент')
	})
})

describe('PopularLandings', () => {
	it('shows the short label and the product count on every tile', () => {
		renderTiles([tile({ slug: 'pla', h1: 'PLA філамент', product_count: 64 })])

		expect(screen.getByText('PLA')).toBeInTheDocument()
		expect(screen.getByText('64 товари')).toBeInTheDocument()
	})

	it('prints no count at all when the backend did not send one', () => {
		renderTiles([tile({ slug: 'pla', h1: 'PLA філамент', product_count: null })])

		expect(screen.getByText('PLA')).toBeInTheDocument()
		expect(screen.queryByText(/товар/)).not.toBeInTheDocument()
	})

	it('uses the tile image when there is one, and a dot when there is not', () => {
		const { container } = renderTiles([
			tile({ slug: 'pla', h1: 'PLA філамент', image: 'https://cdn.test/pla.webp' }),
			tile({ slug: 'petg', h1: 'PETG філамент' })
		])

		// The tile image is decorative — `alt=''` keeps it out of the accessibility tree, so it
		// is queried as an element rather than by role.
		const images = container.querySelectorAll('img')
		expect(images).toHaveLength(1)
		expect(images[0]).toHaveAttribute('src', 'https://cdn.test/pla.webp')
	})

	it('caps the grid at nine tiles and offers the rest behind «Ще N видів»', () => {
		renderTiles(
			Array.from({ length: 14 }, (_, i) => tile({ slug: `l${i}`, h1: `Вид ${i} філамент` }))
		)

		expect(screen.getAllByRole('link')).toHaveLength(9)
		expect(screen.getByRole('button', { name: 'Ще 5 видів' })).toBeInTheDocument()
	})

	it('shows every tile once there is nothing left to hide', () => {
		renderTiles(
			Array.from({ length: 9 }, (_, i) => tile({ slug: `l${i}`, h1: `Вид ${i} філамент` }))
		)

		expect(screen.getAllByRole('link')).toHaveLength(9)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})

	it('renders nothing when the category has no published landings', () => {
		const { container } = renderTiles([])

		expect(container).toBeEmptyDOMElement()
	})
})
