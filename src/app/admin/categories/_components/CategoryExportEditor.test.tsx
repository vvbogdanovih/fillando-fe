import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CategoryExportEditor } from './CategoryExportEditor'
import { WithDrafts } from './category-drafts.test-utils'

const { categoryExport } = vi.hoisted(() => ({ categoryExport: vi.fn() }))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { categoryExport }
}))
afterEach(cleanup)

it('sends the Google taxonomy only, ID and path together', async () => {
	categoryExport.mockResolvedValue({
		category_id: '000000000000000000000001',
		revision: 5,
		name: 'АВР',
		status: 'active',
		google_product_category: null
	})
	const submit = vi.fn()
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<WithDrafts categoryId='000000000000000000000001' revision={5} onSubmit={submit}>
				<CategoryExportEditor
					categoryId='000000000000000000000001'
					revision={5}
					disabled={false}
				/>
			</WithDrafts>
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Google Shopping' }))
	fireEvent.change(await screen.findByLabelText('ID категорії Google'), {
		target: { value: '500000' }
	})
	// Title/highlight keys and custom labels are gone (owner, 04.11.2026).
	expect(screen.queryByRole('checkbox')).toBeNull()
	expect(screen.queryByText(/custom_label/)).toBeNull()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(screen.getByRole('alert')).toHaveTextContent('числовий ID і шлях разом')
	fireEvent.change(screen.getByLabelText('Шлях категорії Google'), {
		target: { value: 'Hardware > Power' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'export',
		id: '000000000000000000000001',
		body: {
			expected_revision: 5,
			google_product_category: { id: 500000, path: 'Hardware > Power' }
		}
	})
})

it('refuses a path left without its ID instead of saving «no category»', async () => {
	// Half an edit — the ID cleared to be retyped — saved by the page's «Зберегти» would take the
	// Google category off the whole feed of the category.
	categoryExport.mockResolvedValue({
		category_id: '000000000000000000000001',
		revision: 5,
		name: 'АВР',
		status: 'active',
		google_product_category: { id: 500000, path: 'Hardware > Power' }
	})
	const submit = vi.fn()
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<WithDrafts categoryId='000000000000000000000001' revision={5} onSubmit={submit}>
				<CategoryExportEditor
					categoryId='000000000000000000000001'
					revision={5}
					disabled={false}
				/>
			</WithDrafts>
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Google Shopping' }))
	fireEvent.change(await screen.findByLabelText('ID категорії Google'), {
		target: { value: '' }
	})
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(screen.getByRole('alert')).toHaveTextContent('числовий ID і шлях разом')
	expect(submit).not.toHaveBeenCalled()
	// Both empty is the one way to say «no category».
	fireEvent.change(screen.getByLabelText('Шлях категорії Google'), { target: { value: '' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'export',
		id: '000000000000000000000001',
		body: { expected_revision: 5, google_product_category: null }
	})
})
