import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
