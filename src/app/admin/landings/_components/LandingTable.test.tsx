import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingTable } from './LandingTable'
import type { AdminLanding } from '../landings.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

const deleteLanding = vi.fn()
vi.mock('../landings.api', () => ({ landingsApi: { delete: (id: string) => deleteLanding(id) } }))

const revalidateStorefront = vi.fn()
vi.mock('@/common/services/revalidate.service', () => ({
	revalidateStorefront: (...args: unknown[]) => revalidateStorefront(...args)
}))

beforeEach(() => {
	deleteLanding.mockReset()
	revalidateStorefront.mockReset()
})
vi.mock('@/app/admin/categories/categories.api', () => ({
	categoriesApi: {
		getAll: () =>
			Promise.resolve([
				{
					_id: 'cat1',
					name: 'Філамент',
					slug: 'filament',
					image: null,
					order: 0,
					required_attributes: [
						{
							key: 'polymer',
							label: 'Тип пластику',
							filter_type: 'multi-select',
							unit: null
						},
						{
							key: 'finish',
							label: 'Ефект поверхні',
							filter_type: 'multi-select',
							unit: null
						}
					],
					createdAt: '',
					updatedAt: ''
				}
			])
	}
}))

const landing = (over: Partial<AdminLanding> & Pick<AdminLanding, 'h1'>) =>
	({
		_id: over.h1,
		category_id: 'cat1',
		slug: 'pla-silk',
		title: 'title',
		meta_description: 'meta',
		intro_html: '<p>вступ</p>',
		bottom_html: '<p>текст</p>',
		faq: [{ q: 'а?', a: 'б' }],
		filters: {},
		price_min: null,
		price_max: null,
		image: null,
		order: 0,
		status: 'draft',
		product_count: 12,
		...over
	}) as AdminLanding

const renderTable = (landings: AdminLanding[]) => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<LandingTable landings={landings} onSelect={vi.fn()} />
		</QueryClientProvider>
	)
}

const rowOf = (h1: string) => screen.getByText(h1).closest('tr') as HTMLElement

describe('LandingTable', () => {
	it('has the columns of the mock, in order', () => {
		renderTable([landing({ h1: 'PLA Silk' })])

		const headers = screen.getAllByRole('columnheader').map(h => h.textContent?.trim())

		expect(headers).toEqual([
			'Адреса',
			'H1',
			'Закріплені фільтри',
			'Товарів',
			'Контент',
			'Статус',
			'Порядок',
			'Дії'
		])
	})

	it('renders the public address the way a visitor sees it', async () => {
		renderTable([landing({ h1: 'PLA Silk', slug: 'pla-silk' })])

		expect(await screen.findByText('/filament/pla-silk')).toBeInTheDocument()
	})

	/** D3: the column that says which landing would be an empty page. */
	describe('the «Товарів» column', () => {
		it('shows how many products the pinned filters match', () => {
			renderTable([landing({ h1: 'PLA Silk', product_count: 38 })])

			expect(within(rowOf('PLA Silk')).getByText('38')).toBeInTheDocument()
		})

		it('marks a zero, because such a landing may not be published', () => {
			renderTable([landing({ h1: 'Рефіл', order: 40, product_count: 0 })])

			const zero = within(rowOf('Рефіл')).getByText('0')
			expect(zero).toBeInTheDocument()
			expect(zero.className).toContain('text-destructive')
		})
	})

	/** D3: the column that says which of the fourteen still have no copy. */
	describe('the «Контент» column', () => {
		it('reads готовий when both texts and at least one FAQ pair are there', () => {
			renderTable([landing({ h1: 'PLA Silk' })])

			expect(within(rowOf('PLA Silk')).getByText('готовий')).toBeInTheDocument()
		})

		/**
		 * The last three are what Quill actually stores for an editor that was typed into and
		 * cleared again — the backend's sanitizer keeps both `p` and `br`, so measuring the raw
		 * markup counted seven characters of nothing as copy.
		 */
		it.each([
			['no intro', { intro_html: '' }],
			['no bottom text', { bottom_html: '' }],
			['no FAQ', { faq: [] }],
			['whitespace only', { intro_html: '   ' }],
			['an empty paragraph', { intro_html: '<p></p>' }],
			['a paragraph holding one break', { bottom_html: '<p><br /></p>' }],
			['a non-breaking space', { intro_html: '<p>&nbsp;</p>' }]
		])('reads порожній with %s', (_label, missing) => {
			renderTable([
				landing({ h1: 'Без тексту', ...missing } as Partial<AdminLanding> & { h1: string })
			])

			expect(within(rowOf('Без тексту')).getByText('порожній')).toBeInTheDocument()
		})
	})

	/** D4: the editor pinned «Тип пластику», not `polymer`. */
	describe('the pinned filter chips', () => {
		it('names each attribute the way its category names it', async () => {
			renderTable([
				landing({ h1: 'PLA Silk', filters: { polymer: ['PLA'], finish: ['Silk'] } })
			])

			await waitFor(() => expect(screen.getByText('Тип пластику: PLA')).toBeInTheDocument())
			expect(screen.getByText('Ефект поверхні: Silk')).toBeInTheDocument()
		})

		it('falls back to the raw key rather than an empty chip', async () => {
			renderTable([landing({ h1: 'Дивний', filters: { unknown_key: ['X'] } })])

			expect(await screen.findByText('unknown_key: X')).toBeInTheDocument()
		})

		it('says so when a landing pins nothing at all', () => {
			renderTable([landing({ h1: 'Вся категорія', filters: {} })])

			expect(within(rowOf('Вся категорія')).getByText('вся категорія')).toBeInTheDocument()
		})
	})

	/**
	 * Without the purge the category page keeps rendering a «Популярні види» tile pointing at an
	 * address that now 404s, for up to the hour the storefront caches landing lists.
	 */
	it('purges the storefront after a landing is deleted', async () => {
		deleteLanding.mockResolvedValueOnce({ success: true })
		renderTable([landing({ h1: 'PLA Silk' })])

		fireEvent.click(within(rowOf('PLA Silk')).getByTitle('Видалити'))
		// Scoped to the dialog: the row's icon button takes its accessible name from the same
		// `title='Видалити'`.
		const dialog = await screen.findByRole('dialog')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Видалити' }))

		await waitFor(() => expect(revalidateStorefront).toHaveBeenCalledWith('landings'))
	})

	it('sorts by order, then by heading', () => {
		renderTable([
			landing({ h1: 'Яблуко', order: 10 }),
			landing({ h1: 'Абрикос', order: 20 }),
			landing({ h1: 'Банан', order: 10 })
		])

		const headings = screen
			.getAllByRole('row')
			.slice(1)
			.map(r => r.children[1].textContent)

		expect(headings).toEqual(['Банан', 'Яблуко', 'Абрикос'])
	})
})
