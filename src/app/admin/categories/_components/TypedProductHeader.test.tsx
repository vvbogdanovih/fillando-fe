import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * The product page's one «Зберегти» (owner, 2026-11-09: «дуже багато "зберегти" — треба одну
 * кнопку»): edits in several blocks are listed in the product's header and sent as one command;
 * once it is confirmed the drafts are gone.
 */
const { typedProductPage, typedProduct } = vi.hoisted(() => ({
	typedProductPage: vi.fn(),
	typedProduct: vi.fn()
}))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { typedProductPage, typedProduct }
}))
vi.mock('../../vendors/vendors.api', () => ({ vendorsApi: { getAll: vi.fn(async () => []) } }))
vi.mock('../../products/_components/DescriptionBlock', async () => {
	const { useState } = await import('react')
	return {
		// As the real editor: its text lives in its own state, seeded once from `initialValue`.
		DescriptionBlock: ({
			initialValue,
			onChange
		}: {
			initialValue?: { html: string }
			onChange?: (value: object) => void
		}) => {
			const [html, setHtml] = useState(initialValue?.html ?? '')
			return (
				<textarea
					aria-label='Опис'
					value={html}
					onChange={event => {
						setHtml(event.target.value)
						onChange?.({ html: event.target.value, json: { ops: [] } })
					}}
				/>
			)
		}
	}
})

import { TypedProductEditor } from './TypedProductEditor'
import { CategoryDraftsProvider } from './category-drafts'

const category = '000000000000000000000002'
const id = '000000000000000000000001'
const product = {
	product_id: id,
	category_id: category,
	revision: 7,
	name: 'Ковдра',
	published: false,
	definitions: [],
	attributes_v2: [],
	variant_axis: null,
	variants: [{ id, name: 'Ковдра', sku: 'FL-1', slug: 'kovdra', variant_value: null }],
	details: {
		token: 'a'.repeat(64),
		description: { html: '<p>Тепла</p>', json: { ops: [] } },
		variants: [{ id, price: 100, stock: 5, weight_g: 300, images: [] }]
	}
}
beforeEach(() => {
	typedProductPage.mockReset().mockResolvedValue({
		category_id: category,
		revision: 7,
		total: 1,
		next_cursor: null,
		items: [{ id, name: 'Ковдра' }]
	})
	typedProduct.mockReset().mockResolvedValue(product)
})
afterEach(cleanup)

it('lists the unsaved blocks in the header and saves them with one command', async () => {
	const submit = vi.fn()
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<CategoryDraftsProvider>
				<TypedProductEditor
					categoryId={category}
					initialProductId={id}
					revision={7}
					disabled={false}
					onSubmit={submit}
				/>
			</CategoryDraftsProvider>
		</QueryClientProvider>
	)
	fireEvent.change(await screen.findByLabelText('Назва товару'), {
		target: { value: 'Ковдра тепла' }
	})
	fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Увага' } })
	fireEvent.change(screen.getByLabelText('Текст'), { target: { value: 'Без котушки.' } })
	expect(screen.getByText('Не збережено: Характеристики · Попередження')).toBeVisible()
	expect(screen.getByText('Є незбережені зміни')).toBeVisible()
	// The blocks have no save buttons of their own any more.
	expect(screen.queryByRole('button', { name: /^Зберегти / })).not.toBeInTheDocument()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledTimes(1)
	const [command, onSuccess] = submit.mock.calls[0]
	expect(command).toMatchObject({
		type: 'product',
		id,
		body: {
			expected_revision: 7,
			name: 'Ковдра тепла',
			details: {
				token: 'a'.repeat(64),
				description: { html: '<p>Тепла</p>', json: { ops: [] } },
				purchase_notice: { title: 'Увага', text: 'Без котушки.', badge: null }
			}
		}
	})
	// Confirmed by the server: nothing is unsaved.
	act(() => onSuccess())
	expect(screen.queryByText(/^Не збережено/)).not.toBeInTheDocument()
	expect(screen.queryByText('Є незбережені зміни')).not.toBeInTheDocument()
})

it('«Скасувати» puts the stored description back into the editor', async () => {
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<CategoryDraftsProvider>
				<TypedProductEditor
					categoryId={category}
					initialProductId={id}
					revision={7}
					disabled={false}
					onSubmit={vi.fn()}
				/>
			</CategoryDraftsProvider>
		</QueryClientProvider>
	)
	fireEvent.change(await screen.findByLabelText('Опис'), { target: { value: '<p>Чернетка</p>' } })
	expect(screen.getByText('Не збережено: Опис')).toBeVisible()
	fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
	expect(screen.queryByText(/^Не збережено/)).not.toBeInTheDocument()
	// Not only the «unsaved» mark: the text on screen is the stored one again, so the next
	// keystroke cannot bring the dropped edit back into a save.
	expect(screen.getByLabelText('Опис')).toHaveValue('<p>Тепла</p>')
})
