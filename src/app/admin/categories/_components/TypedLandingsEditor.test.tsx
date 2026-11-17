import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TypedLandingsEditor } from './TypedLandingsEditor'

const { typedLandings, configuration, filterPreview, uploadEntityImage } = vi.hoisted(() => ({
	typedLandings: vi.fn(),
	configuration: vi.fn(),
	filterPreview: vi.fn(),
	uploadEntityImage: vi.fn()
}))
vi.mock('@/common/services/entity-image.service', () => ({ uploadEntityImage }))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { typedLandings, configuration, filterPreview }
}))
// Quill needs a real browser; a textarea stands in for it.
vi.mock('@/app/admin/landings/_components/HtmlEditor', () => ({
	HtmlEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
		<textarea
			aria-label='html'
			value={value}
			onChange={event => onChange(event.target.value)}
		/>
	)
}))

const category = '000000000000000000000001'
const definition = (key: string, label: string, extra: object = {}) => ({
	key,
	label,
	value_type: 'string' as const,
	unit: null,
	is_required: false,
	filter_enabled: true,
	filter_type: 'multi-select' as const,
	visible_in_specs: true,
	order: 0,
	multiple: false,
	semantic: 'generic' as const,
	options: [],
	...extra
})
const landing = (extra: object = {}) => ({
	_id: '000000000000000000000040',
	category_id: category,
	slug: 'pla',
	h1: 'Філамент PLA',
	title: 'PLA',
	meta_description: 'PLA для друку',
	intro_html: '',
	bottom_html: '',
	faq: [],
	filters_v2: {
		attributes: [{ key: 'polymer', values: ['PLA'] }],
		category_ids: [],
		brand_ids: [],
		color_families: []
	},
	contract_version: 2,
	image: null,
	order: 0,
	status: 'active' as const,
	product_count: 12,
	...extra
})
function mount(submit = vi.fn()) {
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<TypedLandingsEditor
				categoryId={category}
				categorySlug='filament'
				revision={7}
				disabled={false}
				onSubmit={submit}
			/>
		</QueryClientProvider>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Посадкові сторінки' }))
	return submit
}
beforeEach(() => {
	vi.resetAllMocks()
	configuration.mockResolvedValue({
		definitions: [
			definition('polymer', 'Тип пластику'),
			definition('color', 'Колір', {
				semantic: 'color',
				filter_enabled: false,
				filter_type: null
			})
		]
	})
	filterPreview.mockResolvedValue({
		category_id: category,
		revision: 7,
		total_variants: 30,
		total_products: 5,
		sample_variant_ids: [],
		facets: [
			{
				key: 'polymer',
				values: [
					{ value: 'PLA', count: 20 },
					{ value: 'PETG', count: 10 }
				],
				min: null,
				max: null
			}
		]
	})
})
afterEach(cleanup)

describe('TypedLandingsEditor', () => {
	it('says when the server listed only the first landings (P06)', async () => {
		typedLandings.mockResolvedValue({
			category_id: category,
			revision: 7,
			items: [landing()],
			truncated: true
		})
		mount()
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Показано перші 500 посадкових сторінок категорії; решта тут не відображається.'
		)
	})
	it('lists landings with their storefront counts and creates one with pins', async () => {
		typedLandings.mockResolvedValue({ category_id: category, revision: 7, items: [landing()] })
		const submit = mount()
		expect(await screen.findByText('товарів: 12')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Створити посадкову сторінку' }))
		const form = await screen.findByRole('form', { name: 'Нова посадкова сторінка' })
		fireEvent.change(screen.getByLabelText('Адреса сторінки'), { target: { value: 'petg' } })
		fireEvent.change(screen.getByLabelText('H1'), { target: { value: 'Філамент PETG' } })
		fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'PETG' } })
		fireEvent.change(screen.getByLabelText(/^Опис для пошуку/), {
			target: { value: 'PETG для друку' }
		})
		fireEvent.click(await screen.findByLabelText('PETG'))
		fireEvent.click(screen.getByLabelText('Чорні'))
		// The tile image is uploaded to S3, as in the old landing form, not typed in as a URL.
		uploadEntityImage.mockResolvedValue('https://cdn.example.com/landing/petg.png')
		fireEvent.change(screen.getByLabelText('Завантажити зображення'), {
			target: { files: [new File(['x'], 'tile.png', { type: 'image/png' })] }
		})
		await waitFor(() =>
			expect(screen.getByAltText('Зображення плитки')).toHaveAttribute(
				'src',
				'https://cdn.example.com/landing/petg.png'
			)
		)
		expect(uploadEntityImage).toHaveBeenCalledWith('landing', category, expect.any(File))
		fireEvent.click(screen.getByRole('button', { name: 'Створити сторінку' }))
		await waitFor(() => expect(submit).toHaveBeenCalled())
		expect(submit.mock.calls[0][0]).toMatchObject({
			type: 'landing-create',
			body: {
				image: 'https://cdn.example.com/landing/petg.png',
				category_id: category,
				expected_revision: 7,
				slug: 'petg',
				h1: 'Філамент PETG',
				filters_v2: {
					attributes: [{ key: 'polymer', values: ['PETG'] }],
					color_families: ['black']
				},
				status: 'draft'
			}
		})
		expect(form).toBeInTheDocument()
	})

	it('keeps the address of a published landing and deletes drafts after confirmation', async () => {
		typedLandings.mockResolvedValue({
			category_id: category,
			revision: 7,
			items: [
				landing(),
				landing({
					_id: '000000000000000000000041',
					slug: 'draft',
					h1: 'Чернетка',
					status: 'draft',
					product_count: 0
				})
			]
		})
		const submit = mount()
		fireEvent.click(await screen.findByRole('button', { name: /Філамент PLA/ }))
		expect(await screen.findByLabelText('Адреса сторінки')).toHaveAttribute('readonly')
		expect(
			screen.queryByRole('button', { name: /Видалити чернетку сторінки/ })
		).not.toBeInTheDocument()
		// The address change reloads the form: it waits until the form's own edits are saved.
		const address = screen.getByRole('button', { name: 'Змінити адресу /filament/pla' })
		expect(address).toBeEnabled()
		fireEvent.change(screen.getByLabelText('H1'), { target: { value: 'Філамент PLA 1 кг' } })
		expect(address).toBeDisabled()
		expect(screen.getByText(/Спершу збережіть сторінку/)).toBeVisible()
		fireEvent.change(screen.getByLabelText('H1'), { target: { value: 'Філамент PLA' } })
		expect(address).toBeEnabled()
		fireEvent.click(screen.getByRole('button', { name: /Чернетка \/draft/ }))
		const remove = await screen.findByRole('button', { name: 'Видалити чернетку сторінки' })
		fireEvent.click(remove)
		// The question stands on its own row and the first button stays, switched off: a double
		// click lands on nothing.
		expect(remove).toBeDisabled()
		expect(submit).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
		expect(
			screen.queryByRole('button', { name: 'Так, видалити сторінку /draft' })
		).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Видалити чернетку сторінки' }))
		fireEvent.click(screen.getByRole('button', { name: 'Так, видалити сторінку /draft' }))
		expect(submit).toHaveBeenCalledWith({
			type: 'landing-delete',
			id: '000000000000000000000041',
			body: { expected_revision: 7 }
		})
	})
})
