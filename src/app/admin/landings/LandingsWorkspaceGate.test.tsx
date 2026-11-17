import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LandingsWorkspaceGate } from './LandingsWorkspaceGate'

const { capabilities } = vi.hoisted(() => ({ capabilities: vi.fn() }))
vi.mock('../categories/category-tree.api', () => ({ categoryTreeApi: { capabilities } }))
afterEach(cleanup)
let client: QueryClient
const mount = () => {
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={client}>
			<LandingsWorkspaceGate>
				<p>Старий редактор</p>
			</LandingsWorkspaceGate>
		</QueryClientProvider>
	)
}

it('keeps the legacy editor before the migration', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: false, legacy_writes_enabled: true })
	mount()
	expect(await screen.findByText('Старий редактор')).toBeInTheDocument()
})

it('points to the category workspace once legacy writes are closed', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
	mount()
	expect(await screen.findByRole('link', { name: 'До категорій' })).toHaveAttribute(
		'href',
		'/admin/categories'
	)
	expect(screen.queryByText('Старий редактор')).not.toBeInTheDocument()
})

it('names the section as the sidebar does', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
	mount()
	const pointer = (await screen.findByRole('link', { name: 'До категорій' })).parentElement!
	expect(pointer).toHaveTextContent('Категорії → товарна категорія → «Посадкові сторінки»')
	expect(pointer).not.toHaveTextContent('Categories')
})

it('keeps the screen it chose when a later check of the mode fails', async () => {
	capabilities.mockResolvedValue({ draft_writes_enabled: false, legacy_writes_enabled: true })
	mount()
	const editor = await screen.findByText('Старий редактор')
	capabilities.mockRejectedValue({ status: 503 })
	await act(() => client.invalidateQueries({ queryKey: ['category-tree-capabilities'] }))
	await waitFor(() => expect(capabilities.mock.calls.length).toBeGreaterThan(1))
	expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	// An unsaved landing form lives in it: the very same element, never unmounted.
	expect(screen.getByText('Старий редактор')).toBe(editor)
})
