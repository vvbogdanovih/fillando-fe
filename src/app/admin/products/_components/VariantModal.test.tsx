import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VariantModal } from './VariantModal'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

vi.mock('../products.api', () => ({ productsApi: { uploadImages: vi.fn() } }))
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
