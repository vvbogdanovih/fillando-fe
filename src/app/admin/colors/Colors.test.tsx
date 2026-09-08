import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Colors } from './Colors'
import type { AdminColor } from './colors.schema'

// vitest runs without `globals`, so RTL's automatic cleanup is not registered.
afterEach(cleanup)

const getAll = vi.fn()
vi.mock('./colors.api', () => ({ colorsApi: { getAll: () => getAll(), delete: vi.fn() } }))

const BLACK = {
	_id: '1',
	name_en: 'Black',
	name_uk: 'Чорний',
	slug: 'black',
	family: 'black',
	hex_stops: ['#111418'],
	order: 10,
	variant_count: 34
} as AdminColor

const renderScreen = () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<Colors />
		</QueryClientProvider>
	)
}

describe('Colors screen', () => {
	it('lists the dictionary and offers to create a colour', async () => {
		getAll.mockResolvedValueOnce([BLACK])
		renderScreen()

		expect(await screen.findByText('Black')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Новий колір/ })).toBeEnabled()
	})

	/**
	 * Creating while the dictionary is not on screen would write the new colour into an empty
	 * cache — a dictionary of one out of 103. Worse, `setQueryData` resolves the query, so the
	 * failure notice and its retry button would vanish with it, and nothing refetches
	 * (`refetchOnWindowFocus` is off). Locking the button is what keeps that unreachable.
	 */
	it('locks the create button while the dictionary failed to load', async () => {
		getAll.mockRejectedValueOnce(new Error('boom'))
		renderScreen()

		expect(await screen.findByText('Помилка завантаження кольорів')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: /Новий колір/ })).toBeDisabled()
		expect(screen.getByRole('button', { name: /Спробувати знову/ })).toBeInTheDocument()
	})

	it('locks it while the dictionary is still loading', async () => {
		getAll.mockReturnValueOnce(new Promise(() => {}))
		renderScreen()

		await waitFor(() =>
			expect(screen.getByRole('button', { name: /Новий колір/ })).toBeDisabled()
		)
	})
})

const MINT = {
	...BLACK,
	_id: '2',
	name_en: 'Mint',
	name_uk: 'М’ятний',
	slug: 'mint',
	family: 'green',
	order: 20,
	variant_count: 3
} as AdminColor
const GOLD_SILK = {
	...BLACK,
	_id: '3',
	name_en: 'Gold Silver Silk',
	name_uk: 'Золотисто-срібний',
	slug: 'gold-silver-silk',
	family: 'multicolor',
	order: 30,
	variant_count: 1
} as AdminColor

const searchBox = () => screen.getByRole('searchbox', { name: 'Пошук кольору' })

/**
 * The artboard's «Показано 8 з 48» needs something to narrow the list, or it would always read
 * «122 з 122». The owner chose the search box over striking the counter (2026-09-08); with it
 * on screen, «3 з 3» says «nothing is filtering» rather than repeating itself.
 */
describe('Colors screen — search and counter', () => {
	it('narrows the table and the counter, and clears back', async () => {
		getAll.mockResolvedValueOnce([BLACK, MINT, GOLD_SILK])
		renderScreen()
		expect(await screen.findByText(/Показано 3 з 3/)).toBeInTheDocument()

		fireEvent.change(searchBox(), { target: { value: 'gold' } })
		expect(screen.getByText(/Показано 1 з 3/)).toBeInTheDocument()
		expect(screen.getByText('Gold Silver Silk')).toBeInTheDocument()
		expect(screen.queryByText('Black')).not.toBeInTheDocument()

		fireEvent.change(searchBox(), { target: { value: '' } })
		expect(screen.getByText(/Показано 3 з 3/)).toBeInTheDocument()
		expect(screen.getByText('Black')).toBeInTheDocument()
	})

	it('finds a colour whichever apostrophe is typed', async () => {
		getAll.mockResolvedValueOnce([BLACK, MINT])
		renderScreen()
		await screen.findByText('Black')

		fireEvent.change(searchBox(), { target: { value: "м'ятн" } })
		expect(screen.getByText('Mint')).toBeInTheDocument()
		expect(screen.getByText(/Показано 1 з 2/)).toBeInTheDocument()
	})

	it('says what was searched when nothing matches, inside the table, not as an empty dictionary', async () => {
		getAll.mockResolvedValueOnce([BLACK, MINT])
		renderScreen()
		await screen.findByText('Black')

		fireEvent.change(searchBox(), { target: { value: 'zzz' } })
		const table = screen.getByRole('table')
		expect(within(table).getByText('Нічого не знайдено за «zzz»')).toBeInTheDocument()
		expect(screen.getByText(/Показано 0 з 2/)).toBeInTheDocument()
		expect(screen.queryByText(/Словник порожній/)).not.toBeInTheDocument()
	})

	it('has no search box until the dictionary is on screen', async () => {
		getAll.mockRejectedValueOnce(new Error('boom'))
		renderScreen()
		await screen.findByText('Помилка завантаження кольорів')
		expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
	})
})

describe('Colors screen — the colour dialog', () => {
	it('explains what the four fields are for under the title', async () => {
		getAll.mockResolvedValueOnce([BLACK])
		renderScreen()
		await screen.findByText('Black')

		fireEvent.click(screen.getByRole('button', { name: /Новий колір/ }))
		const dialog = await screen.findByRole('dialog')
		expect(
			within(dialog).getByText(/Канонічна англійська назва від виробника/)
		).toBeInTheDocument()
		expect(within(dialog).getByText(/для Dual-Silk два, для Tri-Silk/)).toBeInTheDocument()
	})
})
