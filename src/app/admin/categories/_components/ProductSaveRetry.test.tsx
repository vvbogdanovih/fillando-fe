import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * A product save through the whole products screen — workspace, editor, variant window — against a
 * refusing server. The Prom sync stamps `stock_updated_at` on every SKU each half hour, which moves
 * the product's details token without moving the catalogue revision: a save made from a product
 * read before it answers `409 PRODUCT_DETAILS_CHANGED`, and the next attempt must be made from the
 * product as it is stored now.
 */
const { tree, capabilities, execute, typedProductPage, typedProduct } = vi.hoisted(() => ({
	tree: vi.fn(),
	capabilities: vi.fn(),
	execute: vi.fn(),
	typedProductPage: vi.fn(),
	typedProduct: vi.fn()
}))
vi.mock('../category-tree.api', async importOriginal => ({
	...(await importOriginal<typeof import('../category-tree.api')>()),
	categoryTreeApi: { tree, capabilities, execute, typedProductPage, typedProduct }
}))
vi.mock('../../vendors/vendors.api', () => ({ vendorsApi: { getAll: vi.fn(async () => []) } }))
vi.mock('../../products/PriceListButton', () => ({ PriceListButton: () => null }))
vi.mock('../../products/products.api', () => ({ productsApi: { uploadImages: vi.fn() } }))
vi.mock('../../products/_components/DescriptionBlock', () => ({ DescriptionBlock: () => null }))
vi.mock('../../products/_components/ImageDropzone', () => ({ ImageDropzone: () => null }))

import { CategoryTreeWorkspace } from './CategoryTreeWorkspace'
import { newDefinition } from '../category-definitions.schema'

const category = '000000000000000000000002'
const id = '000000000000000000000001'
const key = '4c897974-e257-4a09-845f-01d605877811'
const items = [
	{
		_id: category,
		name: 'Автоматика',
		parent_id: null,
		kind: 'product',
		status: 'active',
		slug: 'automation',
		order: 0,
		attribute_contract_version: 2
	}
]
const maker = { ...newDefinition(), key: 'maker', label: 'Виробник', is_required: true }
/** The product as the server answers it: `token` and the SKU's price and stock move with a sync. */
const stored = (token: string, price: number, stock: number, revision = 7) => ({
	product_id: id,
	category_id: category,
	revision,
	published: true,
	name: 'Реле',
	definitions: [maker],
	attributes_v2: [{ k: 'maker', v: 'Acme' }],
	variant_axis: null,
	variants: [
		{ id, name: 'Реле', sku: 'FL-1', slug: 'rele', variant_value: null, status: 'active' }
	],
	details: {
		token: token.repeat(64),
		description: null,
		variants: [{ id, price, stock, weight_g: null, images: [] }]
	}
})
const page = (revision: number) => ({
	category_id: category,
	revision,
	total: 1,
	next_cursor: null,
	items: [{ id, name: 'Реле' }]
})
/** A request takes a turn of the event loop, as a real one does: the screen is busy meanwhile. */
const network = () => new Promise(resolve => setTimeout(resolve, 0))
const refuse = (status: number, details: Record<string, string>) => async () => {
	await network()
	throw { status, details: { details } }
}
const mount = () =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<CategoryTreeWorkspace
				productsOnly
				initialCategoryId={category}
				initialProductId={id}
			/>
		</QueryClientProvider>
	)
beforeEach(() => {
	vi.resetAllMocks()
	sessionStorage.clear()
	tree.mockResolvedValue({ revision: 7, items })
	capabilities.mockResolvedValue({ draft_writes_enabled: true, legacy_writes_enabled: false })
	typedProductPage.mockResolvedValue(page(7))
})
afterEach(cleanup)

it('after PRODUCT_DETAILS_CHANGED reads the product again: the second save goes with the fresh token and prices', async () => {
	typedProduct.mockResolvedValueOnce(stored('a', 100, 5)).mockResolvedValue(stored('b', 120, 9))
	execute
		.mockImplementationOnce(refuse(409, { code: 'PRODUCT_DETAILS_CHANGED' }))
		.mockImplementationOnce(async () => {
			await network()
			tree.mockResolvedValue({ revision: 8, items })
			typedProductPage.mockResolvedValue(page(8))
			typedProduct.mockResolvedValue(stored('b', 120, 9, 8))
			return { operation_id: key, revision: 8, product_id: id }
		})
	mount()
	const edit = await screen.findByRole('button', { name: 'Редагувати FL-1' })
	await waitFor(() => expect(edit).toBeEnabled())
	fireEvent.click(edit)
	// The admin touches the weight only; price and stock stay as they were read.
	fireEvent.change(screen.getByLabelText('Вага для пошти, г'), { target: { value: '1220' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти варіант' }))
	await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
	expect(execute.mock.calls[0][0].command.body.details).toMatchObject({
		token: 'a'.repeat(64),
		variants: [{ id, price: 100, stock: 5, weight_g: 1220 }]
	})
	// The window stays open with what was typed; the untouched fields show the product as stored
	// now, and the reason is said in the window itself — the page's line is behind it.
	const dialog = await screen.findByRole('dialog')
	await waitFor(() =>
		expect(dialog).toHaveTextContent(
			'Дані товару оновились (ціна чи залишок) — перевірте й збережіть ще раз.'
		)
	)
	expect(typedProduct).toHaveBeenCalledTimes(2)
	expect(screen.getByLabelText('Вага для пошти, г')).toHaveValue(1220)
	await waitFor(() => expect(screen.getByLabelText('Ціна, грн')).toHaveValue(120))
	expect(screen.getByLabelText('Залишок')).toHaveValue(9)
	const save = screen.getByRole('button', { name: 'Зберегти варіант' })
	await waitFor(() => expect(save).toBeEnabled())
	fireEvent.click(save)
	await waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
	// Never the old price or stock back over what the sync wrote.
	expect(execute.mock.calls[1][0].command.body.details).toMatchObject({
		token: 'b'.repeat(64),
		variants: [{ id, price: 120, stock: 9, weight_g: 1220 }]
	})
	await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
	expect(await screen.findByText('Зміни збережено й уже діють на сайті.')).toBeVisible()
})

it('a header save refused by PRODUCT_DETAILS_CHANGED is sent again from the product as it is now', async () => {
	typedProduct.mockResolvedValueOnce(stored('a', 100, 5)).mockResolvedValue(stored('b', 120, 9))
	execute
		.mockImplementationOnce(refuse(409, { code: 'PRODUCT_DETAILS_CHANGED' }))
		.mockResolvedValueOnce({ operation_id: key, revision: 8, product_id: id })
	mount()
	fireEvent.change(await screen.findByLabelText('Заголовок'), { target: { value: 'Увага' } })
	fireEvent.change(screen.getByLabelText('Текст'), { target: { value: 'Без кабелю.' } })
	const save = screen.getByRole('button', { name: 'Зберегти' })
	await waitFor(() => expect(save).toBeEnabled())
	fireEvent.click(save)
	await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
	expect(
		await screen.findByText(
			'Дані товару оновились (ціна чи залишок) — перевірте й збережіть ще раз.'
		)
	).toBeVisible()
	// The edit is still there, unsaved, and the product has been read again.
	expect(screen.getByLabelText('Заголовок')).toHaveValue('Увага')
	await waitFor(() => expect(typedProduct).toHaveBeenCalledTimes(2))
	await waitFor(() => expect(screen.getByRole('button', { name: 'Зберегти' })).toBeEnabled())
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	await waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
	expect(execute.mock.calls[1][0].command.body.details).toMatchObject({
		token: 'b'.repeat(64),
		variants: [{ id, price: 120, stock: 9 }],
		purchase_notice: { title: 'Увага', text: 'Без кабелю.', badge: null }
	})
})

it('names the required characteristic a published product lacks, on an ordinary save', async () => {
	typedProduct.mockResolvedValue({ ...stored('a', 100, 5), attributes_v2: [] })
	execute.mockImplementation(refuse(400, { code: 'REQUIRED_VALUE', field: 'maker' }))
	mount()
	const edit = await screen.findByRole('button', { name: 'Редагувати FL-1' })
	await waitFor(() => expect(edit).toBeEnabled())
	fireEvent.click(edit)
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '110' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти варіант' }))
	const dialog = await screen.findByRole('dialog')
	await waitFor(() =>
		expect(dialog).toHaveTextContent('Не заповнено обов’язкову характеристику «Виробник»')
	)
	expect(dialog).not.toHaveTextContent('цільової категорії')
})
