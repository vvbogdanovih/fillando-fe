import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VariantModal } from './VariantModal'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

vi.mock('../products.api', () => ({
	productsApi: { uploadImages: vi.fn(), updateVariant: vi.fn(), addVariant: vi.fn() }
}))
vi.mock('@/app/admin/colors/colors.api', () => ({
	colorsApi: { getAll: () => Promise.resolve([]) }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const renderModal = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<VariantModal
				open
				mode='add'
				productId='p1'
				hasVariants
				onClose={vi.fn()}
				onSuccess={vi.fn()}
			/>
		</QueryClientProvider>
	)
}

describe('VariantModal — the weight field', () => {
	// The same field in the same product needs the same explanation in both editors (I-31).
	it('explains that an empty weight blocks nothing', () => {
		renderModal()

		expect(screen.getByText(/Порожня вага не блокує нічого/)).toBeInTheDocument()
		expect(screen.getByText(/«за тарифом перевізника»/)).toBeInTheDocument()
	})
})

describe('VariantModal — promotion fields (TD-0012)', () => {
	const variant = {
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
		status: 'active' as const,
		color_id: null,
		weight_g: null,
		promo_percent: 15,
		promo_ends_at: '2099-11-01T10:00:00.000Z',
		supplier_price: 460,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z'
	}

	const renderEdit = (over: Partial<typeof variant> = {}) => {
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
		return render(
			<QueryClientProvider client={client}>
				<VariantModal
					open
					mode='edit'
					variant={{ ...variant, ...over }}
					productId='p1'
					hasVariants
					onClose={vi.fn()}
					onSuccess={vi.fn()}
				/>
			</QueryClientProvider>
		)
	}

	it('prefills the percent and the end date from the variant', () => {
		renderEdit()
		expect(screen.getByLabelText('Акція, %')).toHaveValue(15)
		expect((screen.getByLabelText('Акція до') as HTMLInputElement).value).not.toBe('')
	})

	it.each([
		{ price: 40, promo_percent: 1 },
		{ price: 0, promo_percent: 15 },
		{ price: 3, promo_percent: 90 }
	])('preserves configured promo %j when a price edit makes the saving effective', async over => {
		const { productsApi } = await import('../products.api')
		vi.mocked(productsApi.updateVariant).mockClear()
		vi.mocked(productsApi.updateVariant).mockResolvedValue(variant as never)
		renderEdit(over)
		expect(screen.getByLabelText('Акція, %')).toHaveValue(over.promo_percent)
		expect((screen.getByLabelText('Акція до') as HTMLInputElement).value).not.toBe('')
		fireEvent.change(screen.getByLabelText(/Ціна/), { target: { value: '100' } })
		fireEvent.submit(screen.getByRole('button', { name: /Зберегти/ }).closest('form')!)
		await waitFor(() =>
			expect(productsApi.updateVariant).toHaveBeenCalledWith(
				'p1',
				'v1',
				expect.objectContaining({
					price: 100,
					promo_percent: over.promo_percent,
					promo_ends_at: variant.promo_ends_at
				})
			)
		)
	})

	it('leaves the promo fields empty for an ended promotion and says so, so other edits still save', () => {
		renderEdit({ promo_ends_at: '2020-01-01T10:00:00.000Z' })
		expect(screen.getByLabelText('Акція, %')).toHaveValue(null)
		expect((screen.getByLabelText('Акція до') as HTMLInputElement).value).toBe('')
		expect(screen.getByText(/Попередня акція −15 % завершилась/)).toBeInTheDocument()
	})

	it('warns when the previewed sale price drops below what the shop pays', () => {
		// 500 × 0.85 = 425 < 460.
		renderEdit()
		expect(screen.getByRole('status')).toHaveTextContent('Акційна ціна нижча за закупівельну')
	})

	it('shows the figures without a warning when the sale price covers the cost', () => {
		renderEdit({ promo_percent: 5 })
		expect(screen.queryByRole('status')).not.toBeInTheDocument()
		expect(screen.getByText(/Акційна ціна: ₴475\. Закупівля: ₴460\./)).toBeInTheDocument()
	})

	it('shows the range error for a percent outside 1..90', async () => {
		const { productsApi } = await import('../products.api')
		renderEdit()
		fireEvent.change(screen.getByLabelText('Акція, %'), { target: { value: '95' } })
		fireEvent.submit(screen.getByRole('button', { name: /Зберегти/ }).closest('form')!)
		expect(
			await screen.findByText('Відсоток акції — ціле число від 1 до 90')
		).toBeInTheDocument()
		expect(productsApi.updateVariant).not.toHaveBeenCalled()
	})

	it('sends null for both promo fields when the percent is cleared', async () => {
		const { productsApi } = await import('../products.api')
		vi.mocked(productsApi.updateVariant).mockResolvedValue(variant as never)
		renderEdit()
		fireEvent.change(screen.getByLabelText('Акція, %'), { target: { value: '' } })
		fireEvent.submit(screen.getByRole('button', { name: /Зберегти/ }).closest('form')!)
		await waitFor(() =>
			expect(productsApi.updateVariant).toHaveBeenCalledWith(
				'p1',
				'v1',
				expect.objectContaining({ promo_percent: null, promo_ends_at: null })
			)
		)
	})
})
