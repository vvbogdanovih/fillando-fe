import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

describe('Landings screen header', () => {
	it('counts the landings and how many of them are reachable', async () => {
		getAll.mockResolvedValueOnce([
			LANDING,
			{ ...LANDING, _id: '2', h1: 'PLA', status: 'active' },
			{ ...LANDING, _id: '3', h1: 'PETG', status: 'active' }
		])
		renderScreen()

		// The artboard's «Показано N з M» is left out — nothing filters this list — but the
		// active count says how many a visitor can actually reach.
		expect(await screen.findByText(/3 · активних 2/)).toBeInTheDocument()
	})
})
