import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CategorySeoEditor } from './CategorySeoEditor'
import { WithDrafts } from './category-drafts.test-utils'

const { categorySeo } = vi.hoisted(() => ({ categorySeo: vi.fn() }))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { categorySeo }
}))
vi.mock('@/app/admin/landings/_components/HtmlEditor', () => ({
	HtmlEditor: ({
		value,
		onChange,
		readOnly
	}: {
		value: string
		onChange: (value: string) => void
		readOnly?: boolean
	}) => (
		<textarea
			aria-label='html'
			value={value}
			readOnly={readOnly}
			onChange={event => onChange(event.target.value)}
		/>
	)
}))
afterEach(cleanup)

it('previews the storefront fallbacks and saves the edited copy', async () => {
	categorySeo.mockResolvedValue({
		category_id: '000000000000000000000001',
		revision: 4,
		name: 'Філамент',
		slug: 'filament',
		kind: 'product',
		status: 'active',
		seo: { title: null, description: null, h1: null, intro_html: null, bottom_html: null }
	})
	const submit = vi.fn()
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<WithDrafts categoryId='000000000000000000000001' revision={4} onSubmit={submit}>
				<CategorySeoEditor
					categoryId='000000000000000000000001'
					revision={4}
					disabled={false}
				/>
			</WithDrafts>
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Сторінка категорії на сайті' }))
	const preview = await screen.findByRole('group', { name: 'Попередній перегляд у пошуку' })
	expect(preview).toHaveTextContent('Філамент — купити у Fillando | Fillando')
	expect(preview).toHaveTextContent(
		'Філамент у магазині Fillando: ціни, наявність і доставка по Україні.'
	)
	expect(preview).toHaveTextContent('H1 сторінки: Філамент')
	fireEvent.change(screen.getByLabelText(/^Title/), {
		target: { value: 'Філамент для 3D-друку' }
	})
	fireEvent.change(screen.getByLabelText(/^H1/), { target: { value: 'Філамент' } })
	expect(preview).toHaveTextContent('Філамент для 3D-друку | Fillando')
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'seo',
		id: '000000000000000000000001',
		body: {
			expected_revision: 4,
			seo: {
				title: 'Філамент для 3D-друку',
				description: null,
				h1: 'Філамент',
				intro_html: null,
				bottom_html: null
			}
		}
	})
})

it('locks the rich-text editors with the form: a fieldset alone does not stop typing in them', async () => {
	// While a save runs the form is disabled; text typed into an editor then was dropped with
	// the saved draft.
	categorySeo.mockResolvedValue({
		category_id: '000000000000000000000001',
		revision: 4,
		name: 'Філамент',
		slug: 'filament',
		kind: 'product',
		status: 'active',
		seo: { title: null, description: null, h1: null, intro_html: null, bottom_html: null }
	})
	const editor = (disabled: boolean) => (
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<WithDrafts categoryId='000000000000000000000001' revision={4} onSubmit={vi.fn()}>
				<CategorySeoEditor
					categoryId='000000000000000000000001'
					revision={4}
					disabled={disabled}
				/>
			</WithDrafts>
		</QueryClientProvider>
	)
	const view = render(editor(true))
	fireEvent.click(screen.getByRole('button', { name: 'Сторінка категорії на сайті' }))
	await screen.findByRole('group', { name: 'Попередній перегляд у пошуку' })
	for (const field of screen.getAllByLabelText('html')) expect(field).toHaveAttribute('readonly')
	view.unmount()
	render(editor(false))
	fireEvent.click(screen.getByRole('button', { name: 'Сторінка категорії на сайті' }))
	await screen.findByRole('group', { name: 'Попередній перегляд у пошуку' })
	for (const field of screen.getAllByLabelText('html'))
		expect(field).not.toHaveAttribute('readonly')
})
