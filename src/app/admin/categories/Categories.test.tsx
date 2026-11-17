import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/** The categories mode switch (owner, 2026-11-04): one toggle; the old editor only while it writes. */
const { capabilities } = vi.hoisted(() => ({ capabilities: vi.fn() }))
vi.mock('./category-tree.api', () => ({ categoryTreeApi: { capabilities } }))
vi.mock('./_components/CategoryTreeWorkspace', () => ({
	CategoryTreeWorkspace: () => <p>Дерево відкрите</p>
}))
vi.mock('./categories.queries', () => ({
	useCategory: () => ({ data: undefined, isError: false }),
	useCategoryOptions: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
}))
vi.mock('./_components/CategoryList', () => ({ CategoryList: () => <p>Старий список</p> }))
vi.mock('./_components/CategoryForm', () => ({ CategoryForm: () => null }))

import { Categories } from './Categories'

const mount = () =>
	render(
		<QueryClientProvider client={new QueryClient()}>
			<Categories />
		</QueryClientProvider>
	)
beforeEach(() => capabilities.mockReset())
afterEach(cleanup)

it('switches the mode by click and arrow keys while the old editor writes', async () => {
	capabilities.mockResolvedValue({ legacy_writes_enabled: true, draft_writes_enabled: false })
	mount()
	const tree = screen.getByRole('radio', { name: 'Дерево категорій' })
	const legacy = screen.getByRole('radio', { name: 'Попередній редактор' })
	expect(screen.getByRole('radiogroup', { name: 'Режим категорій' })).toBeInTheDocument()
	expect(tree).toHaveAttribute('aria-checked', 'true')
	// Disabled until the capabilities answer that the old editor still writes.
	await waitFor(() => expect(legacy).not.toHaveAttribute('aria-disabled'))
	fireEvent.click(legacy)
	expect(legacy).toHaveAttribute('aria-checked', 'true')
	expect(await screen.findByText('Старий список')).toBeInTheDocument()
	fireEvent.keyDown(legacy, { key: 'ArrowRight' })
	expect(tree).toHaveAttribute('aria-checked', 'true')
	expect(tree).toHaveFocus()
	expect(screen.getByText('Дерево відкрите')).toBeInTheDocument()
})

it('keeps the old editor in sight but disabled after the migration, with the reason', async () => {
	capabilities.mockResolvedValue({ legacy_writes_enabled: false, draft_writes_enabled: true })
	mount()
	expect(
		await screen.findByText('Попередній редактор вимкнено після переходу на новий каталог.')
	).toBeInTheDocument()
	const legacy = screen.getByRole('radio', { name: 'Попередній редактор' })
	expect(legacy).toHaveAttribute('aria-disabled', 'true')
	fireEvent.click(legacy)
	fireEvent.keyDown(screen.getByRole('radio', { name: 'Дерево категорій' }), {
		key: 'ArrowRight'
	})
	expect(legacy).toHaveAttribute('aria-checked', 'false')
	expect(screen.getByText('Дерево відкрите')).toBeInTheDocument()
	expect(screen.queryByText('Старий список')).toBeNull()
})
