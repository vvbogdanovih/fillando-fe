import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryForm } from './CategoryForm'
import { attributeFormSchema, requiredAttributeSchema, type Category } from '../categories.schema'

const { update } = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('../categories.api', () => ({ categoriesApi: { update } }))
afterEach(() => {
	cleanup()
	vi.clearAllMocks()
})
const initial: Category = {
	_id: 'category1',
	name: 'Філамент',
	slug: 'filament',
	image: null,
	order: 0,
	createdAt: '2026-09-11',
	updatedAt: '2026-09-11',
	google_product_category: { id: 499682, path: 'Existing path' },
	required_attributes: [
		{
			key: 'reinforcement',
			label: 'Армування',
			filter_type: 'multi-select',
			unit: null,
			is_required: false
		},
		{
			key: 'finish',
			label: 'Ефект поверхні',
			filter_type: 'multi-select',
			unit: null,
			is_required: true
		}
	]
}

describe('category attribute requiredness', () => {
	it('saves a disabled requirement without removing either filter or changing Google category', async () => {
		update.mockResolvedValue(initial)
		render(
			<QueryClientProvider client={new QueryClient()}>
				<CategoryForm initial={initial} onClose={vi.fn()} />
			</QueryClientProvider>
		)
		const switches = screen.getAllByRole('switch', { name: 'Обов’язкове заповнення' })
		expect(switches[0]).not.toBeChecked()
		expect(switches[1]).toBeChecked()
		fireEvent.click(switches[1])
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		await waitFor(() =>
			expect(update).toHaveBeenCalledWith(
				'category1',
				expect.objectContaining({
					required_attributes: [
						{
							label: 'Армування',
							filter_type: 'multi-select',
							unit: null,
							is_required: false
						},
						{
							label: 'Ефект поверхні',
							filter_type: 'multi-select',
							unit: null,
							is_required: false
						}
					],
					google_product_category: initial.google_product_category
				})
			)
		)
	})
	it.each([undefined, null, 'false', 0])(
		'rejects invalid flag %p in both API response and form',
		flag => {
			const attr = { ...initial.required_attributes[0], is_required: flag }
			expect(requiredAttributeSchema.safeParse(attr).success).toBe(false)
			expect(attributeFormSchema.safeParse(attr).success).toBe(false)
		}
	)
})

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
