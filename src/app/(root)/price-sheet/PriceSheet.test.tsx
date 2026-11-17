import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PriceSheet } from './PriceSheet'
import { adminVariantSchema } from './price-sheet.schema'
const { getAll } = vi.hoisted(() => ({ getAll: vi.fn() }))
vi.mock('./price-sheet.api', () => ({ priceSheetApi: { getAll } }))
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
afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})
it.each([
	{ variant_label: '63 А', color: null, expected: '63 А' },
	{ color: 'Чорний (Black)', expected: 'Чорний (Black)' }
])('shows generic variants and accepts older colour-only responses: $expected', async fixture => {
	const item = adminVariantSchema.parse({
		id: 'v1',
		slug: 'avr-63',
		image: null,
		name: 'AVR',
		manufacturer: null,
		material: null,
		article: 'A1',
		price: 2000,
		in_stock: false,
		stock: 0,
		synced_at: null,
		...fixture
	})
	getAll.mockResolvedValue({ items: [item], total: 1, page: 1, limit: 50 })
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<PriceSheet />
		</QueryClientProvider>
	)
	expect(await screen.findAllByText(fixture.expected)).toHaveLength(2)
	expect(screen.getByRole('columnheader', { name: 'Варіант' })).toBeInTheDocument()
	client.clear()
})

it('reports an add from the price sheet with the article (SKU) and the price paid (F12)', async () => {
	const item = adminVariantSchema.parse({
		id: 'v2',
		slug: 'pla-black',
		image: null,
		name: 'Kingroon PLA — Чорний (Black)',
		manufacturer: 'Kingroon',
		material: 'PLA',
		color: 'Чорний (Black)',
		article: 'FL-000001',
		price: 419,
		sale_price: 356,
		in_stock: true,
		stock: 4,
		synced_at: null
	})
	getAll.mockResolvedValue({ items: [item], total: 1, page: 1, limit: 50 })
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<PriceSheet />
		</QueryClientProvider>
	)
	const [button] = await screen.findAllByRole('button', { name: /В кошик/ })
	await act(async () => button.click())
	const { useCartStore } = await import('@/common/store/useCartStore')
	expect(useCartStore.getState().addItem).toHaveBeenCalledWith(
		'v2',
		1,
		expect.objectContaining({ sku: 'FL-000001' })
	)
	const { trackAddToCart } = await import('@/common/lib/ga4-events')
	expect(trackAddToCart).toHaveBeenCalledWith({
		item_id: 'FL-000001',
		item_name: 'Kingroon PLA — Чорний (Black)',
		price: 356,
		quantity: 1,
		item_brand: 'Kingroon'
	})
	client.clear()
})

it('shows each category with the columns its catalogue filters by (owner, 2026-11-06)', async () => {
	const row = (id: string, category: string, values: Record<string, string>) =>
		adminVariantSchema.parse({
			id,
			slug: id,
			image: null,
			name: id,
			category_id: category,
			values,
			manufacturer: null,
			material: null,
			color: null,
			article: id,
			price: 100,
			in_stock: true,
			stock: 1,
			synced_at: null
		})
	getAll.mockResolvedValue({
		items: [
			row('pla', 'c1', { polymer: 'PLA', color: 'Чорний (Black)' }),
			row('avr', 'c2', {})
		],
		categories: [
			{
				id: 'c1',
				name: 'Філамент',
				columns: [
					{ key: 'polymer', label: 'Тип пластику' },
					{ key: 'color', label: 'Колір' }
				],
				variant_column: false
			},
			{ id: 'c2', name: 'АВР', columns: [], variant_column: true }
		],
		total: 2,
		page: 1,
		limit: 50
	})
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<PriceSheet />
		</QueryClientProvider>
	)
	expect(await screen.findByRole('heading', { name: 'Філамент' })).toBeInTheDocument()
	expect(screen.getByRole('heading', { name: 'АВР' })).toBeInTheDocument()
	const [filament, avr] = screen.getAllByRole('table')
	expect(
		within(filament)
			.getAllByRole('columnheader')
			.map(cell => cell.textContent)
	).toEqual([
		'Фото',
		'Назва',
		'Тип пластику',
		'Колір',
		'Артикул',
		'Вартість',
		'Кількість',
		'Синхронізовано',
		''
	])
	expect(within(filament).getByText('Чорний (Black)')).toBeInTheDocument()
	// The AVR's variation is no column here: it keeps «Варіант».
	expect(within(avr).getByRole('columnheader', { name: 'Варіант' })).toBeInTheDocument()
	expect(screen.queryByRole('columnheader', { name: 'Матеріал' })).toBeNull()
	// The phone card names each value.
	expect(screen.getByText('Тип пластику: PLA · Колір: Чорний (Black)')).toBeInTheDocument()
	client.clear()
})
