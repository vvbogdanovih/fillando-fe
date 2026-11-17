import { cleanup, render, screen, within } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StripItem } from '../[category]/catalog.api'

/**
 * A home page collection as a shelf (owner, 2026-11-14): the dark cover — the admin's photo, the
 * «Вітрина» title, the count and the way in — and the cards beside it.
 */
vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))
// The live background is a canvas: jsdom has none to draw on (see CardAurora.test.tsx).
vi.mock('./CardAurora', () => ({ CardAurora: () => null }))
vi.mock('./StripProductCard', () => ({
	StripProductCard: (props: { item: { id: string }; wide?: boolean; sizes?: string }) => (
		<article
			data-testid='card'
			data-wide={String(Boolean(props.wide))}
			data-sizes={props.sizes}
		/>
	)
}))
const { CollectionShelf } = await import('./CollectionShelf')
const { STRIP_IMAGE_SIZES } = await import('./FeaturedProducts')
afterEach(cleanup)

const items = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		id: `v${i}`,
		slug: `s${i}`
	})) as unknown as StripItem[]
const shelf = (over: Partial<Parameters<typeof CollectionShelf>[0]> = {}) => (
	<CollectionShelf
		title='Витратні матеріали'
		href='/filament'
		label='Дивитися всі'
		image='https://cdn.test/filament.webp'
		count={301}
		items={items(5)}
		{...over}
	/>
)

describe('CollectionShelf', () => {
	it('puts the photo, the title, the count and the way in on the cover — one link', () => {
		const { container } = render(shelf())
		const region = screen.getByRole('region', { name: 'Витратні матеріали' })
		const cover = within(region).getByRole('link')
		expect(cover).toHaveAttribute('href', '/filament')
		expect(cover).toHaveTextContent('Витратні матеріали')
		// The title is the section's heading, as «Новинки» and the band have theirs — under the
		// banner's H1 the collections were the only sections the page's outline did not name.
		expect(cover).toContainElement(
			within(region).getByRole('heading', { level: 2, name: 'Витратні матеріали' })
		)
		expect(cover).toHaveTextContent('301 товар')
		expect(cover).toHaveTextContent('Дивитися всі')
		expect(container.querySelector('img')).toHaveAttribute(
			'src',
			'https://cdn.test/filament.webp'
		)
	})

	it('shows five cards beside the cover and keeps the fifth for the widest screens', () => {
		render(shelf())
		const cards = screen.getAllByTestId('card')
		expect(cards).toHaveLength(5)
		expect(cards.map(card => card.parentElement!.className.includes('max-xl:hidden'))).toEqual([
			false,
			false,
			false,
			false,
			true
		])
		// The strips' one `sizes`: a product on a shelf and in «Новинки» is one download.
		expect(new Set(cards.map(card => card.dataset.sizes))).toEqual(new Set([STRIP_IMAGE_SIZES]))
	})

	it('trims three cards to one full row of two on a phone', () => {
		render(shelf({ items: items(3) }))
		const cards = screen.getAllByTestId('card')
		expect(cards[2].parentElement!.className).toContain('max-md:hidden')
		expect(cards[1].parentElement!.className).not.toContain('hidden')
	})

	it('lays one or two products out as row-wide cards, as every strip does', () => {
		render(shelf({ items: items(2) }))
		expect(screen.getAllByTestId('card').every(card => card.dataset.wide === 'true')).toBe(true)
	})

	it('is a plain cover for a list picked by hand: no photo, no count, the catalogue as the way in', () => {
		const { container } = render(
			shelf({ href: '/catalog', label: 'До каталогу', image: null, count: null })
		)
		const cover = screen.getByRole('link')
		expect(cover).toHaveAttribute('href', '/catalog')
		expect(cover).toHaveTextContent('До каталогу')
		expect(cover).not.toHaveTextContent(/товар/)
		expect(container.querySelector('img')).toBeNull()
	})

	// Owner, 2026-11-15: «картки полиці стають рядом із гортанням, як „Новинки“; на головній видно
	// всі обрані». A category's or a landing's shelf has a page behind «Дивитися всі»; a picked list
	// has none, so its row is the only place its products stand.
	it('lays a list picked by hand out as one row that scrolls, every product in it', () => {
		render(
			shelf({
				rail: true,
				href: '/catalog',
				label: 'До каталогу',
				image: null,
				count: null,
				items: items(12)
			})
		)
		// One region by the title — the row itself, focusable for the keyboard.
		const row = screen.getByRole('region', { name: 'Витратні матеріали' })
		expect(row).toHaveAttribute('tabindex', '0')
		expect(row).toHaveAttribute('data-lenis-prevent-horizontal')
		const cards = within(row).getAllByTestId('card')
		expect(cards).toHaveLength(12)
		// Nothing is trimmed at any width, and a card is a shelf's card: not row-wide, one `sizes`.
		expect(cards.some(card => card.parentElement!.className.includes('hidden'))).toBe(false)
		expect(cards.every(card => card.dataset.wide === 'false')).toBe(true)
		expect(new Set(cards.map(card => card.dataset.sizes))).toEqual(new Set([STRIP_IMAGE_SIZES]))
		// As wide as on the other shelves: five from `xl`, four below; on a phone two and a hint of
		// the third — never the six of «Новинки», which has no cover beside it.
		expect(row.className).toContain('xl:auto-cols-[calc((100%-4*0.75rem)/5)]')
		expect(row.className).toContain('md:auto-cols-[calc((100%-3*0.75rem)/4)]')
		expect(row.className).toContain('auto-cols-[44%]')
		expect(row.className).not.toContain('/6)')
		// The arrows of «Новинки»; the cover stays what it was.
		for (const name of ['Витратні матеріали: попередні', 'Витратні матеріали: наступні'])
			expect(screen.getByRole('button', { name, hidden: true })).toBeInTheDocument()
		const cover = screen.getByRole('link')
		expect(cover).toHaveAttribute('href', '/catalog')
		expect(cover).toContainElement(
			screen.getByRole('heading', { level: 2, name: 'Витратні матеріали' })
		)
	})

	it('keeps the shelf of a category or a landing as it was: no row to scroll, no arrows', () => {
		render(shelf())
		expect(screen.getAllByRole('region')).toHaveLength(1)
		expect(screen.queryByRole('button', { hidden: true })).toBeNull()
		expect(screen.getAllByTestId('card')).toHaveLength(5)
	})

	it('keeps one or two picked products row-wide, with nothing to scroll', () => {
		render(shelf({ rail: true, items: items(2) }))
		expect(screen.getAllByTestId('card').every(card => card.dataset.wide === 'true')).toBe(true)
		expect(screen.queryByRole('button', { hidden: true })).toBeNull()
		expect(screen.getByRole('region', { name: 'Витратні матеріали' }).tagName).toBe('SECTION')
	})
})
