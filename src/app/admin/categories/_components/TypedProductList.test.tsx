import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The product list of the products screen (owner, 2026-11-03): numbered pages of 25 with the
 * category's total, and a name search the server runs over the whole category — searching the
 * 25 rows on screen could not find a product on another page.
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

import { pageWindow, TypedProductEditor } from './TypedProductEditor'
import { CategoryDraftsProvider } from './category-drafts'

const category = '000000000000000000000002'
const names = Array.from({ length: 60 }, (_, index) => `Товар ${index + 1}`)
beforeEach(() => {
	typedProductPage.mockReset().mockImplementation(async (_: string, page: number, q?: string) => {
		const matching = q ? names.filter(name => name.includes(q)) : names
		return {
			category_id: category,
			revision: 7,
			total: matching.length,
			next_cursor: null,
			items: matching
				.slice((page - 1) * 25, page * 25)
				.map((name, index) => ({ id: String(index).padStart(24, '0'), name }))
		}
	})
})
afterEach(cleanup)

const mount = () =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<CategoryDraftsProvider>
				<TypedProductEditor
					categoryId={category}
					revision={7}
					disabled={false}
					onSubmit={vi.fn()}
				/>
			</CategoryDraftsProvider>
		</QueryClientProvider>
	)

describe('the products list', () => {
	it('numbers the pages over the category total and moves between them', async () => {
		mount()
		expect(await screen.findByRole('button', { name: 'Товар 1' })).toBeInTheDocument()
		expect(screen.getByText('60')).toBeInTheDocument()
		const pages = screen.getByRole('navigation', { name: 'Сторінки товарів' })
		expect(within(pages).getByRole('button', { name: '1' })).toHaveAttribute(
			'aria-current',
			'page'
		)
		expect(within(pages).getByRole('button', { name: 'Попередня сторінка' })).toBeDisabled()
		fireEvent.click(within(pages).getByRole('button', { name: '3' }))
		expect(await screen.findByRole('button', { name: 'Товар 51' })).toBeInTheDocument()
		expect(typedProductPage).toHaveBeenLastCalledWith(category, 3, undefined)
		expect(within(pages).getByRole('button', { name: 'Наступна сторінка' })).toBeDisabled()
	})

	it('stays on the chosen page once the search pause has passed with nothing typed', async () => {
		mount()
		await screen.findByRole('button', { name: 'Товар 1' })
		fireEvent.click(screen.getByRole('button', { name: '3' }))
		await screen.findByRole('button', { name: 'Товар 51' })
		// Longer than the 300 ms the search waits after a keystroke: an untouched search box
		// must not send the list back to page 1.
		await new Promise(resolve => setTimeout(resolve, 450))
		expect(screen.getByRole('button', { name: 'Товар 51' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-current', 'page')
		expect(typedProductPage).toHaveBeenLastCalledWith(category, 3, undefined)
	})

	it('searches on the server over the whole category, from page 1', async () => {
		mount()
		await screen.findByRole('button', { name: 'Товар 1' })
		fireEvent.click(screen.getByRole('button', { name: '2' }))
		await screen.findByRole('button', { name: 'Товар 26' })
		fireEvent.change(screen.getByRole('searchbox', { name: 'Пошук товару' }), {
			target: { value: ' Товар 55 ' }
		})
		await waitFor(() =>
			expect(typedProductPage).toHaveBeenLastCalledWith(category, 1, 'Товар 55')
		)
		expect(await screen.findByRole('button', { name: 'Товар 55' })).toBeInTheDocument()
		expect(screen.queryByRole('navigation', { name: 'Сторінки товарів' })).toBeNull()
	})

	it('keeps the search box, with its focus, when it is cleared after a short result', async () => {
		mount()
		await screen.findByRole('button', { name: 'Товар 1' })
		const box = screen.getByRole('searchbox', { name: 'Пошук товару' })
		box.focus()
		fireEvent.change(box, { target: { value: 'Товар 55' } })
		await waitFor(() => expect(screen.queryByRole('button', { name: 'Товар 1' })).toBeNull())
		// One product found — fewer than the list needs to offer a search — and the box is
		// cleared to type another name: it must not leave while the whole list loads again.
		fireEvent.change(box, { target: { value: '' } })
		expect(screen.getByRole('searchbox', { name: 'Пошук товару' })).toBe(box)
		expect(await screen.findByRole('button', { name: 'Товар 1' })).toBeInTheDocument()
		expect(box).toBeInTheDocument()
		expect(box).toHaveFocus()
	})
})

it('shows the first, the last and the neighbours of the current page', () => {
	expect(pageWindow(1, 1)).toEqual([1])
	expect(pageWindow(2, 3)).toEqual([1, 2, 3])
	expect(pageWindow(5, 13)).toEqual([1, null, 4, 5, 6, null, 13])
	expect(pageWindow(1, 13)).toEqual([1, 2, null, 13])
})
