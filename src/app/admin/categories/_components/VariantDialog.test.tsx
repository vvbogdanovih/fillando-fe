import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { vi, it, expect, beforeEach, afterEach } from 'vitest'
import { VariantDialog } from './VariantDialog'
import type { TypedProduct } from '../typed-product.schema'

/**
 * One SKU in one window (owner request 02.11.2026: «список варіантів, натискаю редагувати»):
 * value, price, stock, weight, supplier ids, status, promotion and photos in one write.
 */
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('../../products/products.api', () => ({ productsApi: { uploadImages: upload } }))
vi.mock('../../products/_components/ImageDropzone', () => ({
	// type='button', as the real dropzone's buttons: inside the dialog's form a bare button submits.
	ImageDropzone: ({ images, onChange }: any) => (
		<button
			type='button'
			onClick={() =>
				onChange([
					...images,
					{
						id: 'new',
						status: 'pending',
						file: new File(['image'], 'test.png', { type: 'image/png' })
					}
				])
			}
		>
			Додати фото тест
		</button>
	)
}))
const id = '000000000000000000000001'
const second = '000000000000000000000002'
const product: TypedProduct = {
	product_id: id,
	category_id: id,
	revision: 2,
	name: 'Ковдра',
	definitions: [],
	attributes_v2: [],
	variant_axis: null,
	variants: [{ id, name: 'Ковдра', sku: 'FL-1', slug: 'kovdra', variant_value: null }],
	details: {
		token: 'a'.repeat(64),
		description: null,
		variants: [{ id, price: 100, stock: 5, weight_g: 300, images: [] }]
	}
}
const open = (value: TypedProduct, variant = id, submit = vi.fn()) => {
	render(
		<VariantDialog
			product={value}
			target={{ mode: 'edit', id: variant }}
			disabled={false}
			onClose={vi.fn()}
			onSubmit={submit}
		/>
	)
	return submit
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Зберегти варіант' }))
beforeEach(() => upload.mockReset())
afterEach(cleanup)

it('keeps the concurrency token and explicit zero values, clears unknown shipping weight', async () => {
	const submit = open(product)
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '0' } })
	fireEvent.change(screen.getByLabelText('Залишок'), { target: { value: '0' } })
	fireEvent.change(screen.getByLabelText('Вага для пошти, г'), { target: { value: '' } })
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	const body = submit.mock.calls[0][0].body
	expect(body.details).toEqual({
		token: 'a'.repeat(64),
		description: null,
		variants: [
			{
				id,
				price: 0,
				stock: 0,
				weight_g: null,
				vendor_product_sku: null,
				prom_id: null,
				images: []
			}
		]
	})
	expect(body).not.toHaveProperty('variant_action')
	expect(upload).not.toHaveBeenCalled()
})

it('does not save or turn a blank price into zero', async () => {
	const submit = open(product)
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '' } })
	save()
	expect(await screen.findByRole('alert')).toHaveTextContent('Заповніть ціну')
	expect(submit).not.toHaveBeenCalled()
})

it('failed file upload blocks mutation; retry sends the confirmed URL', async () => {
	upload
		.mockRejectedValueOnce(Error('Upload failed'))
		.mockResolvedValueOnce(['https://example.com/photo.webp'])
	const submit = open(product)
	fireEvent.click(screen.getByText('Додати фото тест'))
	save()
	expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed')
	expect(submit).not.toHaveBeenCalled()
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	expect(submit.mock.calls[0][0].body.details.variants[0].images).toEqual([
		'https://example.com/photo.webp'
	])
})

it('shows and saves the supplier article and Prom id like the old variant form', async () => {
	const submit = open({
		...product,
		details: {
			...product.details!,
			variants: [
				{
					...product.details!.variants[0],
					vendor_product_sku: 'NPLA-1',
					prom_id: '2647333298'
				}
			]
		}
	})
	expect(screen.getByLabelText('ID на Промі (необов’язково)')).toHaveValue('2647333298')
	fireEvent.change(screen.getByLabelText('ID на Промі (необов’язково)'), {
		target: { value: ' 555 ' }
	})
	fireEvent.change(screen.getByLabelText('Артикул вендора (необов’язково)'), {
		target: { value: '' }
	})
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	expect(submit.mock.calls[0][0].body.details.variants[0]).toMatchObject({
		prom_id: '555',
		vendor_product_sku: null
	})
})

const promo: TypedProduct = {
	...product,
	variants: [
		{ ...product.variants[0], supplier_price: 90 },
		{ id: second, name: 'Ковдра 2', sku: 'FL-2', slug: 'kovdra-2', variant_value: null }
	],
	details: {
		...product.details!,
		variants: [
			{ id, price: 100, stock: 5, weight_g: 300, images: [] },
			{
				id: second,
				price: 200,
				stock: 1,
				weight_g: null,
				images: [],
				// Ended: not prefilled, only named; an untouched save must not resend it.
				promo_percent: 10,
				promo_ends_at: '2020-01-01T00:00:00.000Z'
			}
		]
	}
}

it('names an ended promotion without resending it, and leaves the other SKUs alone (TD-0012)', async () => {
	const submit = open(promo, second)
	expect(screen.getByLabelText('Акція, %')).toHaveValue(null)
	expect(screen.getByText(/Акція завершилась/)).toBeInTheDocument()
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	for (const row of submit.mock.calls[0][0].body.details.variants) {
		expect(row).not.toHaveProperty('promo_percent')
		expect(row).not.toHaveProperty('promo_ends_at')
	}
})

it('sets this SKU’s promotion, previews it and warns below cost', async () => {
	const submit = open(promo, id)
	fireEvent.change(screen.getByLabelText('Акція, %'), { target: { value: '15' } })
	expect(screen.getByText('Ціна за акцією: 85 ₴')).toBeInTheDocument()
	expect(screen.getByText('Нижче закупівельної ціни (90 ₴).')).toBeInTheDocument()
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	const [first, other] = submit.mock.calls[0][0].body.details.variants
	expect(first).toMatchObject({ id, promo_percent: 15, promo_ends_at: null })
	expect(other).not.toHaveProperty('promo_percent')
})

const axisDefinition = {
	key: 'current',
	label: 'Струм',
	unit: 'А',
	value_type: 'number' as const,
	multiple: false,
	is_required: false,
	filter_enabled: false,
	filter_type: null,
	visible_in_specs: true,
	semantic: 'generic' as const,
	order: 0,
	options: []
}
const withAxis: TypedProduct = {
	...promo,
	published: true,
	definitions: [axisDefinition],
	variant_axis: { key: 'current' },
	variants: [
		{ ...promo.variants[0], variant_value: 16, status: 'active' },
		{ ...promo.variants[1], variant_value: 32, status: 'active' }
	]
}

it('saves the value, the commerce fields and a status change in one write', async () => {
	const submit = open(withAxis, id)
	fireEvent.change(screen.getByLabelText('Варіант FL-1'), { target: { value: '20' } })
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '120' } })
	fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'archived' } })
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	const body = submit.mock.calls[0][0].body
	expect(body.variants).toEqual([
		{ id, variant_value: 20 },
		{ id: second, variant_value: 32 }
	])
	expect(body.details.variants[0]).toMatchObject({ id, price: 120 })
	expect(body.details.variants[1]).toEqual({
		id: second,
		price: 200,
		stock: 1,
		weight_g: null,
		vendor_product_sku: null,
		prom_id: null,
		images: []
	})
	expect(body.variant_action).toEqual({ type: 'status', id, status: 'archived' })
})

it('refuses a value another SKU already has', async () => {
	const submit = open(withAxis, id)
	fireEvent.change(screen.getByLabelText('Варіант FL-1'), { target: { value: '32' } })
	save()
	expect(await screen.findByRole('alert')).toHaveTextContent('вже має інший варіант')
	expect(submit).not.toHaveBeenCalled()
})

/**
 * A save refused with PRODUCT_DETAILS_CHANGED (the Prom sync rewrote price or stock) is followed
 * by a fresh read of the product while the window stays open.
 */
it('keeps what was typed and takes the stored values of untouched fields after a refused save', async () => {
	const submit = vi.fn()
	const view = (value: TypedProduct, disabled: boolean, failure = '') => (
		<VariantDialog
			product={value}
			target={{ mode: 'edit', id }}
			disabled={disabled}
			failure={failure}
			onClose={vi.fn()}
			onSubmit={submit}
		/>
	)
	const { rerender } = render(view(product, false))
	fireEvent.change(screen.getByLabelText('Вага для пошти, г'), { target: { value: '1220' } })
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	expect(submit.mock.calls[0][0].body.details.variants[0]).toMatchObject({ price: 100, stock: 5 })
	// The workspace is busy with the request, refuses it and reads the product again.
	const synced: TypedProduct = {
		...product,
		details: {
			...product.details!,
			token: 'b'.repeat(64),
			variants: [{ ...product.details!.variants[0], price: 120, stock: 9 }]
		}
	}
	rerender(view(product, true))
	rerender(view(synced, false, 'Дані товару оновились.'))
	expect(await screen.findByRole('alert')).toHaveTextContent(
		'Не збережено. Дані товару оновились.'
	)
	expect(screen.getByLabelText('Ціна, грн')).toHaveValue(120)
	expect(screen.getByLabelText('Залишок')).toHaveValue(9)
	expect(screen.getByLabelText('Вага для пошти, г')).toHaveValue(1220)
	save()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(2))
	expect(submit.mock.calls[1][0].body.details).toMatchObject({
		token: 'b'.repeat(64),
		variants: [{ id, price: 120, stock: 9, weight_g: 1220 }]
	})
})

it('holds the address change back while the window has unsaved input: it would close the window', () => {
	open(product)
	const address = () => screen.getByRole('button', { name: 'Змінити адресу /products/kovdra' })
	expect(address()).toBeEnabled()
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '120' } })
	expect(address()).toBeDisabled()
	expect(screen.getByText(/Спершу збережіть зміни варіанта/)).toBeVisible()
	// Typed back to what is stored: nothing is unsaved.
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '100' } })
	expect(address()).toBeEnabled()
})

it('says a refused field as a sentence, not as the schema’s JSON', async () => {
	const submit = open(product)
	// Past the browser's own checks (the field has no upper bound), refused by the schema.
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '2000000000' } })
	save()
	const alert = await screen.findByRole('alert')
	expect(alert).toHaveTextContent('Ціна — число від 0 до 1 000 000 000.')
	expect(alert).not.toHaveTextContent('"code"')
	expect(submit).not.toHaveBeenCalled()
})

/**
 * «Додати варіант» has the SKU's whole block, photos included, and a SKU becomes active only in a
 * complete product (owner, 2026-11-15).
 */
const ready = (overrides: Partial<TypedProduct> = {}): TypedProduct => ({
	...withAxis,
	published: true,
	readiness: { data_ready: true, issues: [], warnings: [] },
	...overrides
})
const add = (value: TypedProduct, submit = vi.fn()) => {
	render(
		<VariantDialog
			product={value}
			target={{ mode: 'add' }}
			disabled={false}
			onClose={vi.fn()}
			onSubmit={submit}
		/>
	)
	fireEvent.change(screen.getByLabelText('Значення нового варіанта'), { target: { value: '63' } })
	fireEvent.change(screen.getByLabelText('Ціна нового варіанта, грн'), {
		target: { value: '2500' }
	})
	return submit
}
const create = () => fireEvent.click(screen.getByRole('button', { name: 'Створити новий варіант' }))

it('uploads the photos picked for a new variant on submit and sends them with it', async () => {
	upload.mockResolvedValueOnce(['https://example.com/new-1.webp'])
	const submit = add(ready())
	fireEvent.change(screen.getByLabelText('Вага для пошти нового варіанта, г'), {
		target: { value: '1220' }
	})
	fireEvent.click(screen.getByText('Додати фото тест'))
	expect(upload).not.toHaveBeenCalled()
	create()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	// Into the product's own folder: it exists already.
	expect(upload).toHaveBeenCalledWith(id, [expect.any(File)])
	expect(submit.mock.calls[0][0].body.variant_action).toEqual({
		type: 'add',
		variant_value: 63,
		price: 2500,
		stock: 0,
		weight_g: 1220,
		vendor_product_sku: null,
		prom_id: null,
		images: ['https://example.com/new-1.webp'],
		status: 'draft'
	})
})

it('names what is missing when a new variant is asked to be active, and sends nothing', () => {
	const submit = add(
		ready({
			definitions: [
				...withAxis.definitions,
				{ ...withAxis.definitions[0], key: 'maker', label: 'Виробник', is_required: true }
			],
			readiness: {
				data_ready: false,
				issues: [
					{ code: 'REQUIRED_ATTRIBUTE', field: 'maker' },
					{ code: 'DESCRIPTION_REQUIRED', field: 'description' },
					// Another SKU's gap is not this one's.
					{ code: 'IMAGE_REQUIRED', field: 'images', variant_id: second }
				],
				warnings: []
			}
		})
	)
	fireEvent.change(screen.getByLabelText('Статус нового варіанта'), {
		target: { value: 'active' }
	})
	create()
	expect(submit).not.toHaveBeenCalled()
	expect(upload).not.toHaveBeenCalled()
	const alert = screen.getByRole('alert')
	expect([...alert.querySelectorAll('li')].map(item => item.textContent)).toEqual([
		'Заповніть обов’язкову характеристику: Виробник',
		'Додайте опис товару',
		'Додайте фото варіанта · новий варіант'
	])
	// Kept as a draft, it is created as it is.
	fireEvent.change(screen.getByLabelText('Статус нового варіанта'), {
		target: { value: 'draft' }
	})
	expect(screen.queryByRole('alert')).not.toBeInTheDocument()
	create()
	expect(submit).toHaveBeenCalledTimes(1)
})

it('creates a complete new variant active at once', async () => {
	upload.mockResolvedValueOnce(['https://example.com/new-1.webp'])
	const submit = add(ready())
	fireEvent.change(screen.getByLabelText('Статус нового варіанта'), {
		target: { value: 'active' }
	})
	fireEvent.click(screen.getByText('Додати фото тест'))
	create()
	await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
	expect(submit.mock.calls[0][0].body.variant_action).toMatchObject({
		status: 'active',
		images: ['https://example.com/new-1.webp']
	})
})

it('turns a stored SKU active only when it is complete; one that is active already is just saved', async () => {
	const draft = ready({
		variants: [{ ...withAxis.variants[0], status: 'draft' }, withAxis.variants[1]]
	})
	const submit = open(draft, id)
	fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'active' } })
	save()
	expect(await screen.findByRole('alert')).toHaveTextContent('Додайте фото варіанта · FL-1')
	expect(submit).not.toHaveBeenCalled()
	cleanup()
	// The second SKU is active and has no photo either — a migrated one: its price is saved.
	const again = open(draft, second)
	fireEvent.change(screen.getByLabelText('Ціна, грн'), { target: { value: '210' } })
	save()
	await waitFor(() => expect(again).toHaveBeenCalledTimes(1))
	expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
