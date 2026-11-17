import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StripItem } from '../[category]/catalog.api'

/**
 * What a strip hands each card (Lighthouse, 2026-11-11): only the leading cards it is told to are
 * eager — the home page's «Новинки» marks the first, whose photo is the desktop LCP — and every
 * card of either layout carries the same strip sizes, so a product standing in two strips is one
 * download, not two tiers of one photo.
 */
vi.mock('./StripProductCard', () => ({
	StripProductCard: (props: {
		item: { id: string }
		priority?: boolean
		sizes?: string
		wide?: boolean
	}) => (
		<article
			data-testid='card'
			data-priority={String(Boolean(props.priority))}
			data-sizes={props.sizes}
			data-wide={String(Boolean(props.wide))}
		/>
	)
}))
vi.mock('./RailScroller', () => ({
	RailScroller: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))
vi.mock('@/common/components/motion', () => ({
	StaggerGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))
const { FeaturedProducts, STRIP_IMAGE_SIZES } = await import('./FeaturedProducts')
afterEach(cleanup)

const items = Array.from({ length: 6 }, (_, i) => ({
	id: `v${i}`,
	slug: `s${i}`
})) as unknown as StripItem[]

describe('FeaturedProducts — cards', () => {
	it('preloads only the leading cards it is told to and sizes the rail as a strip', () => {
		render(<FeaturedProducts items={items} layout='rail' eagerCards={1} />)
		const cards = screen.getAllByTestId('card')
		expect(cards.map(card => card.dataset.priority)).toEqual([
			'true',
			'false',
			'false',
			'false',
			'false',
			'false'
		])
		expect(new Set(cards.map(card => card.dataset.sizes))).toEqual(new Set([STRIP_IMAGE_SIZES]))
	})

	it('lazy-loads every card by default and sizes the grid exactly like the rail', () => {
		render(<FeaturedProducts items={items} />)
		const cards = screen.getAllByTestId('card')
		expect(cards.every(card => card.dataset.priority === 'false')).toBe(true)
		expect(new Set(cards.map(card => card.dataset.sizes))).toEqual(new Set([STRIP_IMAGE_SIZES]))
	})

	// A grid of six with one card in it read as broken markup (owner, 2026-11-14).
	it.each(['grid', 'rail'] as const)(
		'lays one or two products out as row-wide cards in the %s layout, three as a strip',
		layout => {
			for (const count of [1, 2]) {
				render(<FeaturedProducts items={items.slice(0, count)} layout={layout} />)
				const cards = screen.getAllByTestId('card')
				expect(cards).toHaveLength(count)
				expect(cards.every(card => card.dataset.wide === 'true')).toBe(true)
				// The strip's one `sizes`: the same product in a grid strip is one download.
				expect(cards[0].dataset.sizes).toBe(STRIP_IMAGE_SIZES)
				cleanup()
			}
			render(<FeaturedProducts items={items.slice(0, 3)} layout={layout} />)
			expect(screen.getAllByTestId('card').every(card => card.dataset.wide === 'false')).toBe(
				true
			)
		}
	)
})
