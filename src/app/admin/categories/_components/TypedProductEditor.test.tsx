import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('../../products/products.api', () => ({ productsApi: { uploadImages: upload } }))
vi.mock('../../products/_components/ImageDropzone', () => ({
	// One picked file per click, as the real dropzone adds them: pending, with its `file`.
	ImageDropzone: ({
		images,
		onChange
	}: {
		images: { id: string }[]
		onChange: (images: object[]) => void
	}) => (
		<button
			type='button'
			onClick={() =>
				onChange([
					...images,
					{
						id: `picked-${images.length}`,
						status: 'pending',
						file: new File(['image'], `photo-${images.length}.png`, {
							type: 'image/png'
						})
					}
				])
			}
		>
			Додати фото тест ({images.length})
		</button>
	)
}))

// Quill needs a real browser; a textarea stands in for the edit screen's description editor and
// reports the admin's edits the way it does.
vi.mock('../../products/_components/DescriptionBlock', () => ({
	DescriptionBlock: ({ onChange }: { onChange?: (value: object) => void }) => (
		<textarea
			aria-label='Опис'
			onChange={event => onChange?.({ html: event.target.value, json: { ops: [] } })}
		/>
	)
}))

import { characteristicGroups, ProductForm } from './TypedProductEditor'
import { WithProductDrafts } from './category-drafts.test-utils'
import { CategoryDraftsProvider } from './category-drafts'
import { parseField, type TypedDefinition, type TypedProduct } from '../typed-product.schema'
import { newDefinition } from '../category-definitions.schema'
// Braces on purpose: a function returned from `beforeEach` is run as its cleanup, and
// `mockReset()` returns the mock itself.
beforeEach(() => {
	upload.mockReset()
})
afterEach(cleanup)
const definition = (key: string, value_type: TypedDefinition['value_type']): TypedDefinition => ({
	...newDefinition(),
	key,
	label: key,
	value_type,
	options: [],
	filter_enabled: false,
	filter_type: null,
	// A variation is built on a required characteristic only (owner, 2026-11-06).
	is_required: true
})
const product: TypedProduct = {
	product_id: '000000000000000000000001',
	category_id: '000000000000000000000002',
	revision: 7,
	name: 'АВР',
	attributes_v2: [{ k: 'automatic', v: false }],
	variant_axis: { key: 'current' },
	definitions: [
		definition('current', 'number'),
		definition('automatic', 'boolean'),
		{
			...definition('poles', 'enum'),
			options: [{ id: 'opaque-four', label: 'Чотири', order: 0 }]
		}
	],
	variants: [
		{
			id: '000000000000000000000003',
			name: 'АВР — 16',
			slug: 'stable-16',
			sku: 'FL-16',
			variant_value: 16
		},
		{
			id: '000000000000000000000004',
			name: 'АВР — 32',
			slug: 'stable-32',
			sku: 'FL-32',
			variant_value: 32
		}
	]
}
it('submits typed false and enum IDs, resending the stored axis values untouched', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductForm product={product} disabled={false} onSubmit={submit} />
		</WithProductDrafts>
	)
	// Each SKU's value is edited in its variant window (owner request 02.11.2026), not here.
	expect(screen.queryByLabelText('current · FL-16')).not.toBeInTheDocument()
	fireEvent.change(screen.getByLabelText('poles 1'), { target: { value: 'opaque-four' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'product',
		id: product.product_id,
		body: {
			expected_revision: 7,
			name: 'АВР',
			attributes_v2: [
				{ k: 'automatic', v: false },
				{ k: 'poles', v: 'opaque-four' }
			],
			variant_axis: { key: 'current' },
			variants: [
				{ id: product.variants[0].id, variant_value: 16 },
				{ id: product.variants[1].id, variant_value: 32 }
			]
		}
	})
})
it('on an axis change, asks every SKU for a value and rejects duplicates before a request', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductForm product={product} disabled={false} onSubmit={submit} />
		</WithProductDrafts>
	)
	fireEvent.change(screen.getByLabelText('Вісь варіантів'), { target: { value: 'poles' } })
	fireEvent.change(screen.getByLabelText('poles · FL-16'), { target: { value: 'opaque-four' } })
	fireEvent.change(screen.getByLabelText('poles · FL-32'), { target: { value: 'opaque-four' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
	expect(screen.getByRole('alert')).toHaveTextContent('унікальними')
})
it('keeps draft fields optional and does not treat blank numeric inputs as zero', () => {
	expect(parseField(definition('n', 'number'), '')).toBeNull()
	expect(parseField(definition('n', 'number'), '0')).toBe(0)
	expect(() => parseField(definition('n', 'number'), ' ')).toThrow()
	expect(parseField(definition('s', 'string'), 'Мала, тепла')).toBe('Мала, тепла')
})
it('blocks writes when another catalog command is pending', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} disabled onSubmit={submit}>
			<ProductForm product={product} disabled onSubmit={submit} />
		</WithProductDrafts>
	)
	fireEvent.change(screen.getByLabelText('poles 1'), { target: { value: 'opaque-four' } })
	expect(screen.getByRole('button', { name: 'Зберегти' })).toBeDisabled()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
})
it('clears old axis values when changing the axis and requires explicit new values', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductForm product={product} disabled={false} onSubmit={submit} />
		</WithProductDrafts>
	)
	fireEvent.change(screen.getByLabelText('Вісь варіантів'), { target: { value: 'poles' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
	expect(screen.getByRole('alert')).toHaveTextContent('кожного варіанта')
})

/**
 * An unsaved characteristic outlives a variant-window save (the page reloads the product on the
 * new revision, the draft stays): the header's «Зберегти» then sends each SKU's value as the
 * product holds it now — never the copy taken when the draft began, and never by position.
 */
describe('an unsaved characteristic and a change of the SKUs made meanwhile', () => {
	const third = {
		id: '000000000000000000000005',
		name: 'АВР — 63',
		slug: 'stable-63',
		sku: 'FL-63',
		variant_value: 63
	}
	/** Edits a characteristic on `before`, reloads the page with `after`, saves from the header. */
	const saveAfter = (before: TypedProduct, after: TypedProduct) => {
		const submit = vi.fn()
		const page = (value: TypedProduct) => (
			<WithProductDrafts product={value} onSubmit={submit}>
				<ProductForm
					key={value.revision}
					product={value}
					disabled={false}
					onSubmit={submit}
				/>
			</WithProductDrafts>
		)
		const { rerender } = render(page(before))
		fireEvent.change(screen.getByLabelText('poles 1'), { target: { value: 'opaque-four' } })
		rerender(page(after))
		fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
		return submit
	}
	it('keeps a value changed in the variant window', () => {
		const submit = saveAfter(product, {
			...product,
			revision: 8,
			variants: [product.variants[0], { ...product.variants[1], variant_value: 63 }]
		})
		expect(submit.mock.calls[0][0].body).toMatchObject({
			expected_revision: 8,
			attributes_v2: [
				{ k: 'automatic', v: false },
				{ k: 'poles', v: 'opaque-four' }
			],
			variants: [
				{ id: product.variants[0].id, variant_value: 16 },
				{ id: product.variants[1].id, variant_value: 63 }
			]
		})
	})
	it('does not move values onto other SKUs after one was deleted', () => {
		const submit = saveAfter(
			{ ...product, variants: [...product.variants, third] },
			{ ...product, revision: 8, variants: [product.variants[0], third] }
		)
		expect(submit.mock.calls[0][0].body.variants).toEqual([
			{ id: product.variants[0].id, variant_value: 16 },
			{ id: third.id, variant_value: 63 }
		])
	})
	it('saves after a SKU was added, wherever it stands in the list', () => {
		const submit = saveAfter(product, {
			...product,
			revision: 8,
			variants: [third, ...product.variants]
		})
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(submit.mock.calls[0]?.[0].body.variants).toEqual([
			{ id: third.id, variant_value: 63 },
			{ id: product.variants[0].id, variant_value: 16 },
			{ id: product.variants[1].id, variant_value: 32 }
		])
	})
})

it('creates typed variants with numeric commerce and no client-generated SKU or URL', () => {
	const submit = vi.fn()
	render(
		<CategoryDraftsProvider>
			<ProductForm
				product={product}
				creation={{ vendors: [{ _id: '000000000000000000000010', name: 'Supplier' }] }}
				disabled={false}
				onSubmit={submit}
			/>
		</CategoryDraftsProvider>
	)
	fireEvent.change(screen.getByLabelText('Постачальник'), {
		target: { value: '000000000000000000000010' }
	})
	fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 1'), { target: { value: '0' } })
	fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 2'), {
		target: { value: '200.25' }
	})
	fireEvent.change(screen.getByLabelText('Залишок · варіант 2'), { target: { value: '5' } })
	fireEvent.submit(screen.getByRole('form', { name: 'Новий товар' }))
	expect(submit).toHaveBeenCalledWith({
		type: 'product-create',
		body: {
			category_id: product.category_id,
			vendor_id: '000000000000000000000010',
			expected_revision: 7,
			name: 'АВР',
			attributes_v2: [{ k: 'automatic', v: false }],
			variant_axis: { key: 'current' },
			variants: [
				{ variant_value: 16, price: 0, stock: 0, vendor_product_sku: null, prom_id: null },
				{
					variant_value: 32,
					price: 200.25,
					stock: 5,
					vendor_product_sku: null,
					prom_id: null
				}
			]
		}
	})
	// No photo was picked: nothing is uploaded and no SKU carries `images`.
	expect(upload).not.toHaveBeenCalled()
})

/**
 * Photos are added right in the creation form (owner, 2026-11-15): picked per SKU, uploaded when
 * the form is submitted — the product does not exist yet, so into a folder the form names itself —
 * and sent with the create command.
 */
describe('photos in the creation form', () => {
	const fill = () => {
		const submit = vi.fn()
		render(
			<CategoryDraftsProvider>
				<ProductForm
					product={product}
					creation={{ vendors: [{ _id: '000000000000000000000010', name: 'Supplier' }] }}
					disabled={false}
					onSubmit={submit}
				/>
			</CategoryDraftsProvider>
		)
		fireEvent.change(screen.getByLabelText('Постачальник'), {
			target: { value: '000000000000000000000010' }
		})
		fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 1'), {
			target: { value: '100' }
		})
		fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 2'), {
			target: { value: '200' }
		})
		return submit
	}
	const pick = (row: number) =>
		fireEvent.click(screen.getAllByRole('button', { name: /^Додати фото тест/ })[row])
	const send = () => fireEvent.submit(screen.getByRole('form', { name: 'Новий товар' }))
	const address = (file: File) => `https://cdn.example.com/products/new/${file.name}.webp`

	it('uploads the picked photos on submit and sends them with their SKU, in order', async () => {
		upload.mockImplementation(async (_folder: string, files: File[]) => files.map(address))
		const submit = fill()
		// A photo block per SKU row; two photos for the first SKU, none for the second.
		expect(screen.getAllByRole('button', { name: /^Додати фото тест/ })).toHaveLength(2)
		pick(0)
		pick(0)
		expect(upload).not.toHaveBeenCalled()
		send()
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
		expect(upload).toHaveBeenCalledTimes(2)
		// One folder for the whole form, an id the upload endpoint takes (24 hex).
		const folders = upload.mock.calls.map(call => call[0] as string)
		expect(folders[0]).toMatch(/^[a-f0-9]{24}$/)
		expect(folders[1]).toBe(folders[0])
		expect(submit.mock.calls[0][0]).toMatchObject({ type: 'product-create' })
		expect(submit.mock.calls[0][0].body.variants).toEqual([
			{
				variant_value: 16,
				price: 100,
				stock: 0,
				vendor_product_sku: null,
				prom_id: null,
				images: [
					'https://cdn.example.com/products/new/photo-0.png.webp',
					'https://cdn.example.com/products/new/photo-1.png.webp'
				]
			},
			{ variant_value: 32, price: 200, stock: 0, vendor_product_sku: null, prom_id: null }
		])
	})

	it('does not upload a photo again when the form is submitted once more after a refusal', async () => {
		upload.mockImplementation(async (_folder: string, files: File[]) => files.map(address))
		const submit = fill()
		pick(1)
		send()
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
		expect(upload).toHaveBeenCalledTimes(1)
		// The server refused the command (say, the name is taken): the form stays as it was.
		fireEvent.change(screen.getByLabelText('Назва товару'), { target: { value: 'АВР 2' } })
		send()
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
		expect(upload).toHaveBeenCalledTimes(1)
		expect(submit.mock.calls[1][0].body).toMatchObject({
			name: 'АВР 2',
			variants: [{}, { images: ['https://cdn.example.com/products/new/photo-0.png.webp'] }]
		})
	})

	it('sends nothing when an upload fails, and uploads only what is still missing on the next try', async () => {
		upload
			.mockImplementationOnce(async (_folder: string, files: File[]) => files.map(address))
			.mockRejectedValueOnce(Error('Помилка завантаження зображення: S3 статус 500'))
			.mockImplementation(async (_folder: string, files: File[]) => files.map(address))
		const submit = fill()
		pick(0)
		pick(0)
		send()
		expect(await screen.findByRole('alert')).toHaveTextContent('S3 статус 500')
		expect(submit).not.toHaveBeenCalled()
		send()
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
		// The first photo went up once; only the second was sent again.
		expect(upload).toHaveBeenCalledTimes(3)
		expect((upload.mock.calls[2][1] as File[])[0].name).toBe('photo-1.png')
		expect(submit.mock.calls[0][0].body.variants[0].images).toHaveLength(2)
	})

	it('checks the fields before uploading anything', () => {
		const submit = fill()
		fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 2'), { target: { value: '' } })
		pick(0)
		send()
		expect(screen.getByRole('alert')).toHaveTextContent('ціну й залишок')
		expect(upload).not.toHaveBeenCalled()
		expect(submit).not.toHaveBeenCalled()
	})
})
it('removes an unsaved variant with its own commerce values while preserving its sibling', () => {
	const submit = vi.fn()
	render(
		<CategoryDraftsProvider>
			<ProductForm
				product={product}
				creation={{ vendors: [{ _id: '000000000000000000000010', name: 'Supplier' }] }}
				disabled={false}
				onSubmit={submit}
			/>
		</CategoryDraftsProvider>
	)
	fireEvent.change(screen.getByLabelText('Постачальник'), {
		target: { value: '000000000000000000000010' }
	})
	fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 1'), { target: { value: '111' } })
	fireEvent.change(screen.getByLabelText('Ціна, грн · варіант 2'), { target: { value: '222' } })
	fireEvent.click(screen.getByRole('button', { name: 'Прибрати варіант 1' }))
	fireEvent.submit(screen.getByRole('form', { name: 'Новий товар' }))
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			body: expect.objectContaining({
				variants: [
					{
						variant_value: 32,
						price: 222,
						stock: 0,
						vendor_product_sku: null,
						prom_id: null
					}
				]
			})
		})
	)
})
/**
 * «Усе одразу» and «чернетка, активний — коли повний» (owner, 2026-11-15): the creation form has
 * the edit screen's blocks, a new product is a draft unless «Активний» is chosen, and an active
 * one is sent only when it is complete — otherwise the form names what is missing.
 */
describe('a whole product in the creation form', () => {
	const published: TypedProduct = { ...product, published: true }
	const open = (value: TypedProduct = published) => {
		const submit = vi.fn()
		render(
			<CategoryDraftsProvider>
				<ProductForm
					product={value}
					creation={{ vendors: [{ _id: '000000000000000000000010', name: 'Supplier' }] }}
					disabled={false}
					onSubmit={submit}
				/>
			</CategoryDraftsProvider>
		)
		fireEvent.change(screen.getByLabelText('Постачальник'), {
			target: { value: '000000000000000000000010' }
		})
		return submit
	}
	const type = (label: string, value: string) =>
		fireEvent.change(screen.getByLabelText(label), { target: { value } })
	const send = () => fireEvent.submit(screen.getByRole('form', { name: 'Новий товар' }))
	const photo = (row: number) =>
		fireEvent.click(screen.getAllByRole('button', { name: /^Додати фото тест/ })[row])

	it('has the edit screen’s blocks in its order', () => {
		open()
		const headings = screen
			.getAllByRole('heading')
			.map(heading => heading.textContent)
			.filter(text => !/^(Основне|Фільтри|Лише|Не показуються)/.test(text ?? ''))
		expect(headings).toEqual([
			'Новий товар',
			'Характеристики товару',
			'Варіанти · current',
			'Попередження перед покупкою (необов’язково)'
		])
		// The description stands between «Основне» and the characteristics, as on the edit screen.
		const order = (element: Element, other: Element) =>
			element.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING
		expect(
			order(screen.getByLabelText('Назва товару'), screen.getByLabelText('Опис'))
		).toBeTruthy()
		expect(order(screen.getByLabelText('Опис'), screen.getByLabelText('poles 1'))).toBeTruthy()
		expect(
			order(
				screen.getAllByRole('button', { name: /^Додати фото тест/ })[1],
				screen.getByLabelText('Заголовок')
			)
		).toBeTruthy()
		expect(order(screen.getByLabelText('Текст'), screen.getByLabelText('Статус'))).toBeTruthy()
	})

	it('sends the description, the purchase notice and each SKU’s weight with the creation', () => {
		const submit = open()
		type('Опис', '<p>Автомат резерву для дому.</p>')
		type('Заголовок', ' Увага ')
		type('Текст', 'Монтує електрик.')
		type('Ціна, грн · варіант 1', '100')
		type('Ціна, грн · варіант 2', '200')
		type('Вага для пошти, г · варіант 2', '1220')
		send()
		expect(submit.mock.calls[0][0].body).toMatchObject({
			description: { html: '<p>Автомат резерву для дому.</p>', json: { ops: [] } },
			purchase_notice: { title: 'Увага', text: 'Монтує електрик.', badge: null },
			variants: [{ price: 100 }, { price: 200, weight_g: 1220 }]
		})
		// An unknown weight is simply not sent.
		expect(submit.mock.calls[0][0].body.variants[0]).not.toHaveProperty('weight_g')
	})

	it('sends neither a description nor a notice that was left empty', () => {
		const submit = open()
		type('Опис', '<p><br></p>')
		type('Ціна, грн · варіант 1', '100')
		type('Ціна, грн · варіант 2', '200')
		send()
		const body = submit.mock.calls[0][0].body
		expect(body).not.toHaveProperty('description')
		expect(body).not.toHaveProperty('purchase_notice')
	})

	it('creates a draft by default in a published category too, however incomplete', () => {
		const submit = open()
		expect(screen.getByLabelText('Статус')).toHaveValue('draft')
		expect(screen.getByRole('button', { name: 'Створити чернетку товару' })).toBeEnabled()
		type('Ціна, грн · варіант 1', '100')
		type('Ціна, грн · варіант 2', '200')
		send()
		expect(
			submit.mock.calls[0][0].body.variants.map((row: { status: string }) => row.status)
		).toEqual(['draft', 'draft'])
		expect(screen.queryByText(/Бракує/)).not.toBeInTheDocument()
	})

	it('has no status to choose in a draft category: nothing there goes on sale', () => {
		const submit = open(product)
		expect(screen.queryByLabelText('Статус')).not.toBeInTheDocument()
		type('Ціна, грн · варіант 1', '100')
		type('Ціна, грн · варіант 2', '200')
		send()
		expect(submit.mock.calls[0][0].body.variants[0]).not.toHaveProperty('status')
	})

	it('names what an active product still lacks and sends nothing, uploads nothing', () => {
		upload.mockImplementation(async (_folder: string, files: File[]) =>
			files.map(file => `https://cdn.example.com/products/new/${file.name}.webp`)
		)
		const submit = open({
			...published,
			attributes_v2: [],
			definitions: published.definitions.map(row =>
				row.key === 'automatic' ? { ...row, label: 'Автоматичний режим' } : row
			)
		})
		type('Статус', 'active')
		expect(screen.getByRole('button', { name: 'Створити товар' })).toBeEnabled()
		type('Ціна, грн · варіант 1', '0')
		type('Ціна, грн · варіант 2', '200')
		photo(1)
		send()
		expect(submit).not.toHaveBeenCalled()
		expect(upload).not.toHaveBeenCalled()
		const gaps = within(screen.getByRole('alert'))
			.getAllByRole('listitem')
			.map(item => item.textContent)
		expect(gaps).toEqual([
			'Заповніть обов’язкову характеристику: Автоматичний режим',
			'Заповніть обов’язкову характеристику: poles',
			'Додайте опис товару',
			'Вкажіть ціну більшу за нуль · варіант 1',
			'Додайте фото варіанта · варіант 1'
		])
		expect(screen.getByRole('alert')).toHaveTextContent('залиште статус «Чернетка»')
		// Kept as a draft, the same form is sent as it is.
		type('Статус', 'draft')
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		send()
		return waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	})

	it('sends a complete product active at once', async () => {
		upload.mockImplementation(async (_folder: string, files: File[]) =>
			files.map(file => `https://cdn.example.com/products/new/${file.name}.webp`)
		)
		const submit = open()
		type('Статус', 'active')
		type('Опис', '<p>Автомат резерву.</p>')
		type('poles 1', 'opaque-four')
		type('Ціна, грн · варіант 1', '100')
		type('Ціна, грн · варіант 2', '200')
		photo(0)
		photo(1)
		send()
		await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
		expect(screen.queryByRole('alert')).not.toBeInTheDocument()
		expect(submit.mock.calls[0][0].body).toMatchObject({
			description: { html: '<p>Автомат резерву.</p>' },
			variants: [
				{ status: 'active', price: 100, images: [expect.stringContaining('photo-0')] },
				{ status: 'active', price: 200, images: [expect.stringContaining('photo-0')] }
			]
		})
	})
})
it('says an empty name as a sentence, not as the schema’s JSON', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductForm product={product} disabled={false} onSubmit={submit} />
		</WithProductDrafts>
	)
	fireEvent.change(screen.getByLabelText('Назва товару'), { target: { value: ' ' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
	expect(screen.getByRole('alert')).toHaveTextContent('Назва товару — від 1 до 200 символів.')
})
it('requires a price rather than treating an empty price as zero', () => {
	const submit = vi.fn()
	render(
		<CategoryDraftsProvider>
			<ProductForm
				product={product}
				creation={{ vendors: [] }}
				disabled={false}
				onSubmit={submit}
			/>
		</CategoryDraftsProvider>
	)
	fireEvent.submit(screen.getByRole('form', { name: 'Новий товар' }))
	expect(submit).not.toHaveBeenCalled()
	expect(screen.getByRole('alert')).toHaveTextContent('ціну й залишок')
})

it('changes the supplier of an existing product only when another one is chosen', () => {
	const submit = vi.fn()
	const vendors = [
		{ _id: '000000000000000000000070', name: 'Kingroon' },
		{ _id: '000000000000000000000071', name: 'Sunlu' }
	]
	const supplied = { ...product, vendor_id: vendors[0]._id }
	render(
		<WithProductDrafts product={supplied} onSubmit={submit}>
			<ProductForm product={supplied} vendors={vendors} disabled={false} onSubmit={submit} />
		</WithProductDrafts>
	)
	// Nothing changed is nothing to save: a renamed product keeps its supplier out of the body.
	fireEvent.change(screen.getByLabelText('Назва товару'), { target: { value: 'АВР 2' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[0][0].body).not.toHaveProperty('vendor_id')
	fireEvent.change(screen.getByLabelText('Постачальник'), { target: { value: vendors[1]._id } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[1][0].body.vendor_id).toBe(vendors[1]._id)
})
it('groups the characteristics by what they do for the shopper, under titled sections', () => {
	const flags = (key: string, filter_enabled: boolean, visible_in_specs: boolean) => ({
		...definition(key, 'string'),
		filter_enabled,
		filter_type: filter_enabled ? ('multi-select' as const) : null,
		visible_in_specs
	})
	const groups = characteristicGroups([
		flags('polymer', true, true),
		flags('material', false, true),
		flags('internal', false, false),
		flags('vendor', true, false)
	])
	expect(groups.map(group => [group.title, group.items.map(item => item.key)])).toEqual([
		['Фільтри на сайті', ['polymer', 'vendor']],
		['Лише на сторінці товару', ['material']],
		['Не показуються покупцю', ['internal']]
	])
	expect(characteristicGroups([flags('polymer', true, true)]).map(group => group.key)).toEqual([
		'filters'
	])
	render(
		<CategoryDraftsProvider>
			<ProductForm
				product={{
					...product,
					definitions: [...product.definitions, flags('polymer', true, true)]
				}}
				disabled={false}
				onSubmit={vi.fn()}
			/>
		</CategoryDraftsProvider>
	)
	expect(screen.getByRole('region', { name: 'Основне' })).toBeInTheDocument()
	expect(screen.getByRole('region', { name: /Фільтри на сайті/ })).toHaveTextContent(
		'Покупець відбирає за ними товари в каталозі.'
	)
})

it('offers a variation only on a required list, number, yes/no or colour (owner, 2026-11-06)', () => {
	const withOthers: TypedProduct = {
		...product,
		definitions: [
			...product.definitions,
			definition('label', 'string'),
			{ ...definition('optional', 'number'), is_required: false }
		]
	}
	render(
		<WithProductDrafts product={withOthers} onSubmit={vi.fn()}>
			<ProductForm product={withOthers} disabled={false} onSubmit={vi.fn()} />
		</WithProductDrafts>
	)
	const options = [...(screen.getByLabelText('Вісь варіантів') as HTMLSelectElement).options].map(
		option => option.value
	)
	expect(options).toEqual(['', 'current', 'automatic', 'poles'])
})

it('makes a required colour the variation and never asks for a colour on the product', () => {
	const colour: TypedDefinition = {
		...definition('color', 'string'),
		label: 'Колір',
		semantic: 'color'
	}
	const single: TypedProduct = {
		...product,
		attributes_v2: [],
		variant_axis: null,
		definitions: [colour, definition('automatic', 'boolean')],
		variants: [{ ...product.variants[0], variant_value: null }]
	}
	// The colour axis reads the dictionary for its picker.
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	render(
		<QueryClientProvider client={client}>
			<CategoryDraftsProvider>
				<ProductForm product={single} disabled={false} onSubmit={vi.fn()} />
			</CategoryDraftsProvider>
		</QueryClientProvider>
	)
	const select = screen.getByLabelText('Вісь варіантів') as HTMLSelectElement
	expect(select.value).toBe('color')
	expect([...select.options].map(option => [option.value, option.disabled])).toEqual([
		['', true],
		['color', false]
	])
	// The colour is chosen per SKU from the dictionary: no product-level colour field.
	expect(screen.queryByText('Колір 1')).not.toBeInTheDocument()
	expect(screen.queryByLabelText('color 1')).not.toBeInTheDocument()
	client.clear()
})
