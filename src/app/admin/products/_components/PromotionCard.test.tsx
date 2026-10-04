import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductVariantFull } from '../products.schema'
import { productsApi } from '../products.api'
import { PromotionCard } from './PromotionCard'

afterEach(cleanup)

vi.mock('../products.api', () => ({
	productsApi: { getVariants: vi.fn(), setPromotion: vi.fn() }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/common/services/revalidate.service', () => ({ revalidateStorefront: vi.fn() }))

const variant = (over: Partial<ProductVariantFull> = {}): ProductVariantFull => ({
	_id: 'v1',
	product_id: 'p1',
	category_id: 'c1',
	name: 'PLA — Чорний',
	slug: 'pla-black',
	sku: 'FL-000001',
	price: 500,
	stock: 5,
	images: [],
	v_value: 'Black',
	status: 'active',
	color_id: null,
	weight_g: null,
	promo_percent: null,
	promo_ends_at: null,
	supplier_price: 460,
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
	...over
})

const renderCard = (variants: ProductVariantFull[]) => {
	vi.mocked(productsApi.getVariants).mockResolvedValue(variants)
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<PromotionCard productId='p1' />
		</QueryClientProvider>
	)
	return client
}

const applyButton = () => screen.getByRole('button', { name: 'Застосувати до всіх варіантів' })

beforeEach(() => {
	vi.mocked(productsApi.setPromotion).mockReset()
})

describe('PromotionCard', () => {
	it('says there is no promotion and applies one to every variant, without a date', async () => {
		const updated = [variant({ promo_percent: 15 }), variant({ _id: 'v2', promo_percent: 15 })]
		vi.mocked(productsApi.setPromotion).mockResolvedValue(updated)
		const client = renderCard([variant(), variant({ _id: 'v2', sku: 'FL-000002' })])
		expect(await screen.findByText('Акції немає.')).toBeInTheDocument()

		fireEvent.change(screen.getByLabelText('Знижка'), { target: { value: '15' } })
		fireEvent.click(applyButton())

		await waitFor(() =>
			expect(productsApi.setPromotion).toHaveBeenCalledWith('p1', {
				promo_percent: 15,
				promo_ends_at: null
			})
		)
		await waitFor(() => expect(client.getQueryData(['variants', 'p1'])).toEqual(updated))
	})

	it('sends the end date as ISO and describes a uniform promotion', async () => {
		vi.mocked(productsApi.setPromotion).mockResolvedValue([])
		renderCard([variant({ promo_percent: 10, promo_ends_at: '2099-11-01T10:00:00.000Z' })])
		expect(await screen.findByText(/Діє акція −10 % на всі 1 варіант/)).toBeInTheDocument()

		fireEvent.change(screen.getByLabelText('Знижка'), { target: { value: '20' } })
		fireEvent.change(screen.getByLabelText('Діє до (необов’язково)'), {
			target: { value: '2099-01-01T12:00' }
		})
		fireEvent.click(applyButton())

		await waitFor(() =>
			expect(productsApi.setPromotion).toHaveBeenCalledWith('p1', {
				promo_percent: 20,
				promo_ends_at: new Date('2099-01-01T12:00').toISOString()
			})
		)
	})

	it('removes the promotion with promo_percent: null', async () => {
		vi.mocked(productsApi.setPromotion).mockResolvedValue([variant()])
		renderCard([variant({ promo_percent: 10 })])
		fireEvent.click(await screen.findByRole('button', { name: 'Прибрати акцію' }))
		await waitFor(() =>
			expect(productsApi.setPromotion).toHaveBeenCalledWith('p1', { promo_percent: null })
		)
	})

	it.each(['0', '91', 'abc', ''])('keeps the button disabled for %p', async value => {
		renderCard([variant()])
		await screen.findByText('Акції немає.')
		fireEvent.change(screen.getByLabelText('Знижка'), { target: { value } })
		expect(applyButton()).toBeDisabled()
	})

	it('refuses a date in the past before asking the server', async () => {
		renderCard([variant()])
		await screen.findByText('Акції немає.')
		fireEvent.change(screen.getByLabelText('Знижка'), { target: { value: '10' } })
		fireEvent.change(screen.getByLabelText('Діє до (необов’язково)'), {
			target: { value: '2020-01-01T12:00' }
		})
		expect(applyButton()).toBeDisabled()
		expect(screen.getByText('Дата завершення має бути в майбутньому.')).toBeInTheDocument()
	})

	it('names the variants a percent would sell below cost, and still allows it', async () => {
		renderCard([variant(), variant({ _id: 'v2', sku: 'FL-000002', supplier_price: 300 })])
		await screen.findByText('Акції немає.')
		fireEvent.change(screen.getByLabelText('Знижка'), { target: { value: '10' } })
		// 500 → 450: below the 460 supplier price of FL-000001, above the 300 of FL-000002.
		const warning = screen.getByRole('status')
		expect(warning).toHaveTextContent('FL-000001 (≈450 ₴ < 460 ₴)')
		expect(warning).not.toHaveTextContent('FL-000002')
		expect(applyButton()).toBeEnabled()
	})

	it('does not call an ended promotion live, and offers to clear it', async () => {
		renderCard([variant({ promo_percent: 10, promo_ends_at: '2020-01-01T10:00:00.000Z' })])
		expect(
			await screen.findByText(/Акція завершилась .* — покупець бачить регулярну ціну/)
		).toBeInTheDocument()
		expect(screen.queryByText(/Діє акція/)).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Очистити завершену акцію' })).toBeInTheDocument()
	})

	it('reports mixed per-variant promotions instead of a single one', async () => {
		renderCard([variant({ promo_percent: 10 }), variant({ _id: 'v2', sku: 'FL-000002' })])
		expect(await screen.findByText(/Акція по варіантах: 1 з 2/)).toBeInTheDocument()
	})
})
