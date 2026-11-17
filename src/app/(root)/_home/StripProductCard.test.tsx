import { act, cleanup, render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StripItem } from '../[category]/catalog.api'
import { CARD_SWATCHES, StripProductCard } from './StripProductCard'

afterEach(cleanup)

vi.mock('next/image', () => ({
	default: (
		props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; preload?: boolean }
	) => {
		const { fill: _fill, preload: _preload, ...rest } = props
		return <img {...rest} alt={rest.alt ?? ''} />
	}
}))
vi.mock('@/common/lib/ga4-events', () => ({ trackAddToCart: vi.fn() }))
vi.mock('@/common/store/useCartStore', async () => {
	const { create } = await import('zustand')
	const useCartStore = create(() => ({
		items: [] as { variant_id: string }[],
		guestItems: [] as { variant_id: string }[],
		addItem: vi.fn().mockResolvedValue(undefined),
		openCart: vi.fn()
	}))
	return { useCartStore }
})

const black = { name_uk: 'Чорний', name_en: 'Black', family: 'black', hex_stops: ['#1a1a1a'] }
const swatches = (count: number, inStock = count) =>
	Array.from({ length: count }, (_, i) => ({
		family: 'blue',
		hex_stops: [`#0000${10 + i}`],
		in_stock: i < inStock
	}))

const item = (
	group: Partial<StripItem['group']> = {},
	overrides: Partial<StripItem> = {}
): StripItem => ({
	id: 'v1',
	product_id: 'p1',
	name: 'Bambu Lab PLA-CF — Філамент — Чорний',
	slug: 'bambu-lab-pla-cf-black',
	sku: 'FL-000301',
	price: 2610,
	price_updated_at: '2026-09-01T00:00:00.000Z',
	stock: 5,
	v_value: 'Black',
	attributes: [],
	main_image: 'https://cdn.example.invalid/black.jpg',
	color: black,
	...overrides,
	group: {
		name: 'Bambu Lab PLA-CF — Філамент',
		count: 1,
		in_stock: 1,
		on_sale: 0,
		price_min: 2610,
		price_max: 2610,
		colors_count: 1,
		colors: swatches(1),
		...group
	}
})

describe('StripProductCard — one card per product (owner, 2026-11-14)', () => {
	it('stands for the product: its name, the colours, «від» the lowest price and a way to choose', () => {
		render(
			<StripProductCard
				item={item({
					count: 10,
					in_stock: 4,
					price_min: 2010,
					price_max: 2610,
					colors_count: 10,
					colors: swatches(10, 4)
				})}
				href='/products/bambu-lab-pla-cf-black'
			/>
		)
		// The product's name — never the SKU's, whose colour the card used to cut off.
		expect(screen.getByText('Bambu Lab PLA-CF — Філамент')).toBeInTheDocument()
		expect(screen.queryByText(/Чорний/)).not.toBeInTheDocument()
		// Decoration beside «10 кольорів», so hidden from a screen reader.
		expect(screen.getAllByRole('img', { name: 'Колір', hidden: true })).toHaveLength(
			CARD_SWATCHES
		)
		expect(screen.getByText(`+${10 - CARD_SWATCHES}`)).toBeInTheDocument()
		// The assortment and what can be bought now; the sold-out colours stay, faded.
		expect(screen.getByText('10 кольорів · 4 у наявності')).toBeInTheDocument()
		const dots = screen.getAllByRole('img', { name: 'Колір', hidden: true })
		expect(dots.filter(dot => dot.className.includes('opacity-30'))).toHaveLength(
			CARD_SWATCHES - 4
		)
		expect(screen.getByText('2 010 ₴').textContent).toMatch(/^від\s/)
		expect(screen.getByRole('link', { name: 'Обрати колір' })).toHaveAttribute(
			'href',
			'/products/bambu-lab-pla-cf-black'
		)
		// A product is not one line of the cart, and has no one article.
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
		expect(screen.queryByText(/Арт\./)).not.toBeInTheDocument()
	})

	it('prints one price without «від» when every SKU costs the same', () => {
		render(
			<StripProductCard
				item={item({ count: 4, in_stock: 4, colors_count: 4, colors: swatches(4) })}
				href='/x'
			/>
		)
		expect(screen.getByText('2 610 ₴').textContent).not.toContain('від')
		expect(screen.getByText('4 кольори')).toBeInTheDocument()
	})

	it('badges a product only when every SKU of the group is on sale', () => {
		const promo = { sale_price: 2375, promo_percent: 9, promo_ends_at: null }
		const group = { count: 4, in_stock: 4, colors_count: 4, colors: swatches(4) }
		render(<StripProductCard item={item({ ...group, on_sale: 1 }, promo)} href='/x' />)
		// One colour of four is discounted: the card stands for all four.
		expect(screen.queryByText('−9 %')).not.toBeInTheDocument()
		cleanup()
		render(<StripProductCard item={item({ ...group, on_sale: 4 }, promo)} href='/x' />)
		expect(screen.getByText('−9 %')).toBeInTheDocument()
	})

	it('calls SKUs that are not all colours variants, and passes no value off as a colour', () => {
		render(
			<StripProductCard
				item={item(
					{ name: 'АВР TOMZN', count: 3, in_stock: 3, colors_count: 0, colors: [] },
					{ color: null }
				)}
				href='/x'
			/>
		)
		// The characteristic's own name is never printed: no word of the admin's to decline.
		expect(screen.getByText('3 варіанти')).toBeInTheDocument()
		expect(screen.queryByRole('img', { name: 'Колір', hidden: true })).not.toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Обрати варіант' })).toBeInTheDocument()
	})

	it('keeps one SKU a thing to buy: the colour on its own line, its price, «В кошик» with the SKU name', async () => {
		const { useCartStore } = await import('@/common/store/useCartStore')
		const { container } = render(
			<StripProductCard
				item={item({}, { sale_price: 2375, promo_percent: 9, promo_ends_at: null })}
				href='/x'
			/>
		)
		expect(screen.getByText('Bambu Lab PLA-CF — Філамент')).toBeInTheDocument()
		expect(screen.getByText('Чорний (Black)')).toBeInTheDocument()
		expect(screen.getByText('−9 %')).toBeInTheDocument()
		expect(screen.getByText('2 375 ₴')).toBeInTheDocument()
		expect(container.querySelector('s')).toHaveTextContent('2 610 ₴')
		await act(async () => {
			screen.getByRole('button', { name: 'В кошик' }).click()
		})
		// The cart line carries the SKU's own name, as the product page puts it there.
		expect(useCartStore.getState().addItem).toHaveBeenCalledWith(
			'v1',
			1,
			expect.objectContaining({
				name: 'Bambu Lab PLA-CF — Філамент — Чорний (Black)',
				price: 2610,
				sale_price: 2375,
				sku: 'FL-000301'
			})
		)
	})

	it('prints the SKU name itself when one SKU has no colour to put beside it', () => {
		render(
			<StripProductCard
				item={item(
					{ name: 'АВР TOMZN', colors_count: 0, colors: [] },
					{ name: 'АВР TOMZN — 63 А', color: null }
				)}
				href='/x'
			/>
		)
		expect(screen.getByText('АВР TOMZN — 63 А')).toBeInTheDocument()
	})

	it('offers nothing to press when nothing of the product is in stock', () => {
		render(
			<StripProductCard
				item={item({ count: 3, in_stock: 0, colors_count: 3, colors: swatches(3, 0) })}
				href='/x'
			/>
		)
		expect(screen.getByText('Немає в наявності')).toBeInTheDocument()
		// Said once, by the card: the count line does not repeat «0 у наявності».
		expect(screen.getByText('3 кольори')).toBeInTheDocument()
		expect(screen.queryByRole('link', { name: 'Обрати колір' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button')).not.toBeInTheDocument()
	})

	it('lays the same card out row-wide, the promotion and its end beside the name', () => {
		const { container } = render(
			<StripProductCard
				wide
				item={item(
					{},
					{ sale_price: 2375, promo_percent: 9, promo_ends_at: '2099-12-01T12:00:00Z' }
				)}
				href='/x'
			/>
		)
		expect(screen.getByText('−9 %')).toBeInTheDocument()
		expect(screen.getByText('до 01.12')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'В кошик' })).toBeInTheDocument()
		// The badge is a block: never inside a paragraph (a hydration error).
		expect(container.querySelector('p div')).toBeNull()
	})
})
