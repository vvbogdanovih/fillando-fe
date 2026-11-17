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
	it('shows the short label and the product count on every pill', () => {
		renderTiles([tile({ slug: 'pla', h1: 'PLA філамент', product_count: 64 })])

		// The figure for the eye, the words around it for a screen reader — and one text for both and
		// for a crawler reading the link: «PLA, 64 товари», never «PLA64, 64 товари».
		const pill = screen.getByRole('link', { name: 'PLA, 64 товари' })
		expect(pill).toHaveAttribute('href', '/filament/pla')
		expect(pill.textContent).toBe('PLA, 64 товари')
		// Only the figure is seen beside the label.
		expect(
			[...pill.querySelectorAll('span')]
				.filter(span => !span.className.includes('sr-only'))
				.map(span => span.textContent)
		).toEqual(['64'])
	})

	it('shows no pill for a landing with no products — a known empty listing (P02)', () => {
		renderTiles([
			tile({ slug: 'pla', h1: 'PLA філамент', product_count: 64 }),
			tile({ slug: 'nylon', h1: 'Nylon філамент', product_count: 0 })
		])

		expect(screen.getByText('PLA')).toBeInTheDocument()
		expect(screen.queryByText('Nylon')).not.toBeInTheDocument()
		expect(screen.queryByText(/0 товарів/)).not.toBeInTheDocument()
	})

	it('renders nothing when every landing is empty', () => {
		const { container } = renderTiles([tile({ slug: 'nylon', h1: 'Nylon', product_count: 0 })])

		expect(container).toBeEmptyDOMElement()
	})

	it('prints no count at all when the backend did not send one', () => {
		renderTiles([tile({ slug: 'pla', h1: 'PLA філамент', product_count: null })])

		expect(screen.getByRole('link', { name: 'PLA' })).toBeInTheDocument()
		expect(screen.queryByText(/товар/)).not.toBeInTheDocument()
	})

	it('shows the admin image when there is one, and no invented mark when there is not', () => {
		const { container } = renderTiles([
			tile({ slug: 'pla', h1: 'PLA філамент', image: 'https://cdn.test/pla.webp' }),
			tile({ slug: 'petg', h1: 'PETG філамент' })
		])

		// The image is decorative — `alt=''` keeps it out of the accessibility tree, so it is
		// queried as an element rather than by role.
		const images = container.querySelectorAll('img')
		expect(images).toHaveLength(1)
		expect(images[0]).toHaveAttribute('src', 'https://cdn.test/pla.webp')
		// The dot coloured by a hash of the slug is gone: beside filament it read as a colour.
		expect(container.querySelector('[style*="background"]')).toBeNull()
	})

	it('shows every landing — no «Ще N видів», and a long name whole (owner, 2026-11-14)', () => {
		renderTiles([
			...Array.from({ length: 13 }, (_, i) =>
				tile({ slug: `l${i}`, h1: `Вид ${i} філамент` })
			),
			tile({ slug: 'abs', h1: 'ABS пластик для 3D-друку' })
		])

		// These pills are the category's internal links to its landings: all of them visible.
		const links = screen.getAllByRole('link')
		expect(links).toHaveLength(14)
		expect(links.every(link => !link.hasAttribute('hidden'))).toBe(true)
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
		expect(screen.getByText('ABS пластик для 3D-друку').className).not.toContain('truncate')
	})

	it('takes its own category per pill on the hub, and the hub heading in the display face', () => {
		render(
			<PopularLandings
				title='Популярні добірки'
				display
				landings={[
					tile({
						slug: 'pla',
						h1: 'PLA філамент',
						category: { slug: 'filament', name: 'Філамент' }
					})
				]}
			/>
		)

		expect(screen.getByRole('link', { name: /PLA/ })).toHaveAttribute('href', '/filament/pla')
		expect(screen.getByRole('heading', { name: 'Популярні добірки' }).className).toContain(
			'font-display'
		)
	})

	// The short label drops the category's name, which is the page's own heading on a category. The
	// hub's pills come from every category at once: shortened there, «Однополюсні» and «Чорний»
	// stood side by side with nothing to say of what (review 2026-11-14).
	it('prints the whole H1 on the hub, where no heading names the category', () => {
		render(
			<PopularLandings
				title='Популярні добірки'
				display
				landings={[
					tile({
						slug: 'pla',
						h1: 'PLA філамент',
						category: { slug: 'filament', name: 'Філамент' }
					}),
					tile({
						slug: 'odnopolyusni',
						h1: 'Однополюсні автоматичні вимикачі',
						product_count: null,
						category: { slug: 'avtomaty', name: 'Автоматичні вимикачі' }
					})
				]}
			/>
		)

		expect(screen.getByRole('link', { name: 'PLA філамент, 12 товарів' })).toHaveAttribute(
			'href',
			'/filament/pla'
		)
		expect(
			screen.getByRole('link', { name: 'Однополюсні автоматичні вимикачі' })
		).toHaveAttribute('href', '/avtomaty/odnopolyusni')
	})

	it('keeps the quiet label on a category page', () => {
		renderTiles([tile({ slug: 'pla', h1: 'PLA філамент' })])

		expect(screen.getByRole('heading', { name: 'Популярні види' }).className).not.toContain(
			'font-display'
		)
	})

	it('renders nothing when the category has no published landings', () => {
		const { container } = renderTiles([])

		expect(container).toBeEmptyDOMElement()
	})
})
