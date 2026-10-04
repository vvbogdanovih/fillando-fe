import { act, cleanup, render, screen } from '@testing-library/react'
import type { ImgHTMLAttributes } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogItem } from '../catalog.api'
import { CatalogProductCard } from './CatalogProductCard'

afterEach(cleanup)

vi.mock('next/image', () => ({
	default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
		<img {...props} alt={props.alt ?? ''} />
	)
}))
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

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
	id: 'v1',
	name: 'Kingroon PLA — Чорний (Black)',
	slug: 'kingroon-pla-black',
	sku: 'FL-000001',
	price: 419,
	price_updated_at: '2026-09-01T00:00:00.000Z',
	stock: 5,
	v_value: 'Black',
	attributes: [],
	main_image: 'https://cdn.example.invalid/black.jpg',
	color: null,
	...overrides
})

describe('CatalogProductCard — promotions (TD-0012)', () => {
	it('prints one price and no badge without a promotion', () => {
		const { container } = render(<CatalogProductCard item={item()} href='/x' />)
		expect(screen.getByText('419 ₴')).toBeInTheDocument()
		expect(screen.queryByText(/−\d+ %/)).not.toBeInTheDocument()
		expect(container.querySelector('s')).toBeNull()
	})

	it('shows the badge over the photo, the sale price and the struck regular price', () => {
		const { container } = render(
			<CatalogProductCard
				item={item({
					sale_price: 356,
					promo_percent: 15,
					promo_ends_at: '2099-11-01T12:00:00Z'
				})}
				href='/x'
			/>
		)
		expect(screen.getByText('−15 %')).toHaveAttribute('title', 'Акція до 01.11')
		expect(screen.getByText('356 ₴')).toBeInTheDocument()
		expect(container.querySelector('s')).toHaveTextContent('419 ₴')
	})

	it('still captions the regular price date when out of stock, promo or not', () => {
		render(
			<CatalogProductCard
				item={item({ stock: 0, sale_price: 356, promo_percent: 15 })}
				href='/x'
			/>
		)
		expect(screen.getByText('ціна на 01.09')).toBeInTheDocument()
		expect(screen.getByText('−15 %')).toBeInTheDocument()
	})

	it('hands the regular price and the promo fields to the cart', async () => {
		const { useCartStore } = await import('@/common/store/useCartStore')
		render(
			<CatalogProductCard
				item={item({ sale_price: 356, promo_percent: 15, promo_ends_at: null })}
				href='/x'
			/>
		)
		await act(async () => {
			screen.getByRole('button', { name: /В кошик/ }).click()
		})
		expect(useCartStore.getState().addItem).toHaveBeenCalledWith(
			'v1',
			1,
			expect.objectContaining({ price: 419, sale_price: 356, promo_ends_at: null })
		)
	})
})
