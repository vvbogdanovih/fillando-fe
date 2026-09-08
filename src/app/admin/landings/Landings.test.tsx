import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Landings } from './Landings'
import type { AdminLanding } from './landings.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

const getAll = vi.fn()
vi.mock('./landings.api', () => ({ landingsApi: { getAll: () => getAll(), delete: vi.fn() } }))
vi.mock('@/app/admin/categories/categories.api', () => ({
	categoriesApi: { getAll: () => Promise.resolve([]) }
}))
// The screen reaches the storefront purge through the table; mocked at the service so the
// assertions here stay about what is on screen.
vi.mock('@/common/services/revalidate.service', () => ({ revalidateStorefront: vi.fn() }))

const LANDING = {
	_id: '1',
	category_id: 'cat1',
	slug: 'pla-silk',
	h1: 'PLA Silk',
	title: 't',
	meta_description: 'm',
	intro_html: '',
	bottom_html: '',
	faq: [],
	filters: {},
	price_min: null,
	price_max: null,
	image: null,
	order: 10,
	status: 'draft',
	product_count: 38
} as AdminLanding

const renderScreen = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<Landings />
		</QueryClientProvider>
	)
}

describe('Landings screen', () => {
	it('lists the landings and offers to create one', async () => {
		getAll.mockResolvedValueOnce([LANDING])
		renderScreen()

		expect(await screen.findByText('PLA Silk')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Новий лендінг/ })).toBeEnabled()
	})

	/**
	 * Same trap as the colours screen: creating against a list that never loaded would leave the
	 * cache holding that one landing, and writing to the cache also resolves the query, so the
	 * failure notice would disappear with it.
	 */
	it('locks the create button while the list failed to load', async () => {
		getAll.mockRejectedValueOnce(new Error('boom'))
		renderScreen()

		expect(await screen.findByText('Помилка завантаження лендінгів')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Новий лендінг/ })).toBeDisabled()
	})

	it('locks it while the list is still loading', async () => {
		getAll.mockReturnValueOnce(new Promise(() => {}))
		renderScreen()

		await waitFor(() =>
			expect(screen.getByRole('button', { name: /Новий лендінг/ })).toBeDisabled()
		)
	})
})

const THREE = [
	LANDING,
	{ ...LANDING, _id: '2', h1: 'PLA', slug: 'pla', status: 'active' },
	{ ...LANDING, _id: '3', h1: 'PETG', slug: 'petg', status: 'active' }
] as AdminLanding[]

const searchBox = () => screen.getByRole('searchbox', { name: 'Пошук лендінгу' })

describe('Landings screen header', () => {
	it('reads «Показано N з M · активних K», with K over the whole list', async () => {
		getAll.mockResolvedValueOnce(THREE)
		renderScreen()

		expect(await screen.findByText(/Показано 3 з 3 · активних 2/)).toBeInTheDocument()

		// Narrowing to the one draft keeps K at 2: it says how many a visitor can reach, not how
		// many are on screen — the artboard's «7 з 14 · активних 11» has K above N too.
		fireEvent.change(searchBox(), { target: { value: 'чернетк' } })
		expect(screen.getByText(/Показано 1 з 3 · активних 2/)).toBeInTheDocument()
		expect(screen.getByText('PLA Silk')).toBeInTheDocument()
		expect(screen.queryByText('PETG')).not.toBeInTheDocument()
	})

	it('matches the H1 and says what was searched when nothing matches', async () => {
		getAll.mockResolvedValueOnce(THREE)
		renderScreen()
		await screen.findByText('PLA Silk')

		fireEvent.change(searchBox(), { target: { value: 'petg' } })
		expect(screen.getByText('PETG')).toBeInTheDocument()
		expect(screen.queryByText('PLA Silk')).not.toBeInTheDocument()

		fireEvent.change(searchBox(), { target: { value: 'zzz' } })
		expect(
			within(screen.getByRole('table')).getByText('Нічого не знайдено за «zzz»')
		).toBeInTheDocument()
		expect(screen.queryByText(/Лендінгів немає/)).not.toBeInTheDocument()
	})
})
