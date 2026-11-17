import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * The gate between the old products screens and the new catalogue workspace: the old ones only
 * while the catalogue has no control document (before the migration), and never a screen swapped
 * out from under the admin's unsaved work because one later capability check failed.
 */
const { capabilities, typedProduct } = vi.hoisted(() => ({
	capabilities: vi.fn(),
	typedProduct: vi.fn()
}))
vi.mock('../categories/category-tree.api', () => ({
	categoryTreeApi: { capabilities, typedProduct }
}))
vi.mock('../categories/_components/CategoryTreeWorkspace', () => ({
	CategoryTreeWorkspace: (props: { initialCategoryId?: string; initialProductId?: string }) => (
		<p>
			Нові товари {props.initialCategoryId ?? '—'} {props.initialProductId ?? '—'}
		</p>
	)
}))

import { ProductWorkspaceGate } from './ProductWorkspaceGate'

const category = '000000000000000000000002'
const product = '000000000000000000000001'
let client: QueryClient
const mount = (props: { productId?: string; categoryId?: string } = {}) => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<ProductWorkspaceGate {...props}>
				<p>Старі товари</p>
			</ProductWorkspaceGate>
		</QueryClientProvider>
	)
}
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

it('keeps the old screen before the migration and shows neither while the mode is unknown', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: false, legacy_writes_enabled: true })
	mount()
	expect(screen.getByText('Завантаження каталогу…')).toBeInTheDocument()
	expect(screen.queryByText('Старі товари')).not.toBeInTheDocument()
	expect(await screen.findByText('Старі товари')).toBeInTheDocument()
	expect(screen.queryByText(/Нові товари/)).not.toBeInTheDocument()
})

it('opens the workspace once legacy writes are closed, on the category asked for', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
	mount({ categoryId: category })
	expect(await screen.findByText(`Нові товари ${category} —`)).toBeInTheDocument()
	expect(screen.queryByText('Старі товари')).not.toBeInTheDocument()
})

it('opens a product’s deep link in the workspace, on the product’s own category', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
	typedProduct.mockResolvedValue({ product_id: product, category_id: category })
	mount({ productId: product })
	expect(await screen.findByText(`Нові товари ${category} ${product}`)).toBeInTheDocument()
})

it('shows neither screen when the mode cannot be read at all', async () => {
	capabilities.mockRejectedValue({ status: 503 })
	mount()
	expect(await screen.findByRole('alert')).toHaveTextContent(
		'Не вдалося перевірити режим каталогу'
	)
	expect(screen.queryByText('Старі товари')).not.toBeInTheDocument()
	expect(screen.queryByText(/Нові товари/)).not.toBeInTheDocument()
})

it('keeps the workspace when a later check of the mode fails: its unsaved edits live in it', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
	mount()
	const workspace = await screen.findByText(/Нові товари/)
	// The workspace re-reads the capabilities after every command; one of those reads fails.
	capabilities.mockRejectedValue({ status: 503 })
	await act(() => client.invalidateQueries({ queryKey: ['category-tree-capabilities'] }))
	await waitFor(() => expect(capabilities).toHaveBeenCalledTimes(2))
	expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	// The very same element: it was never unmounted.
	expect(screen.getByText(/Нові товари/)).toBe(workspace)
})
