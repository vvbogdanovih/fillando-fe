import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryForm } from './CategoryForm'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

// The form only reads the API on submit, and no test here submits.
vi.mock('../categories.api', () => ({
	categoriesApi: { create: vi.fn(), update: vi.fn(), uploadImage: vi.fn() }
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const renderForm = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<CategoryForm initial={null} onClose={vi.fn()} />
		</QueryClientProvider>
	)
}

describe('CategoryForm — Google Merchant section', () => {
	it('says what an empty Google category does, so the blank field is not read as unfinished', () => {
		renderForm()

		expect(screen.getByText(/Порожнє поле не блокує фід/)).toBeInTheDocument()
		expect(screen.getByText('google_product_category')).toBeInTheDocument()
		expect(screen.getByText(/у звіті генерації з'явиться попередження/)).toBeInTheDocument()
	})

	// Plan-0005 I-27: without a unit the storefront's characteristics table cannot print
	// «Вага філаменту, кг», so the editor has to offer one per required attribute.
	it('lets a required attribute carry a unit', () => {
		renderForm()

		fireEvent.click(screen.getByRole('button', { name: /Додати/ }))
		const unit = screen.getByLabelText(/Одиниця/)
		fireEvent.change(unit, { target: { value: 'кг' } })

		expect(unit).toHaveValue('кг')
	})
})
