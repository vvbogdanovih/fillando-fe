import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, it, expect, vi } from 'vitest'
import { ProductVariantsEditor } from './ProductVariantsEditor'
import type { TypedProduct } from '../typed-product.schema'
afterEach(cleanup)
const id = '000000000000000000000001'
const product: TypedProduct = {
	product_id: id,
	category_id: id,
	revision: 2,
	name: 'АВР',
	definitions: [
		{
			key: 'current',
			label: 'Струм',
			unit: 'А',
			value_type: 'number',
			multiple: false,
			is_required: false,
			filter_enabled: false,
			filter_type: null,
			visible_in_specs: true,
			semantic: 'generic',
			order: 0,
			options: []
		}
	],
	attributes_v2: [],
	variant_axis: { key: 'current' },
	variants: [
		{
			id,
			name: 'АВР — 16 А',
			variant_value: 16,
			sku: 'FL-1',
			slug: 'avr-16-a',
			status: 'archived'
		}
	]
}
it('restores archived identity through the shared pending command', () => {
	const submit = vi.fn()
	render(<ProductVariantsEditor product={product} disabled={false} onSubmit={submit} />)
	fireEvent.click(screen.getByRole('button', { name: 'Відновити FL-1' }))
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			type: 'product',
			body: expect.objectContaining({
				expected_revision: 2,
				variant_action: { type: 'restore', id }
			})
		})
	)
})
it('rejects duplicate values including archived siblings', () => {
	const submit = vi.fn()
	render(<ProductVariantsEditor product={product} disabled={false} onSubmit={submit} />)
	fireEvent.click(screen.getByRole('button', { name: 'Додати варіант' }))
	fireEvent.change(screen.getByLabelText('Значення нового варіанта'), { target: { value: '16' } })
	fireEvent.click(screen.getByText('Створити новий варіант'))
	expect(screen.getByRole('alert')).toHaveTextContent('вже існує')
	expect(submit).not.toHaveBeenCalled()
})
it('sends typed zero stock and unknown weight, without client-generated SKU or URL', () => {
	const submit = vi.fn()
	render(<ProductVariantsEditor product={product} disabled={false} onSubmit={submit} />)
	fireEvent.click(screen.getByRole('button', { name: 'Додати варіант' }))
	fireEvent.change(screen.getByLabelText('Значення нового варіанта'), { target: { value: '32' } })
	fireEvent.change(screen.getByLabelText('Ціна нового варіанта, грн'), {
		target: { value: '1250.5' }
	})
	fireEvent.click(screen.getByText('Створити новий варіант'))
	expect(submit.mock.calls[0][0].body.variant_action).toEqual({
		type: 'add',
		variant_value: 32,
		price: 1250.5,
		stock: 0,
		weight_g: null,
		vendor_product_sku: null,
		prom_id: null
	})
})
it('links a new variant to Prom and a supplier article, as the old variant form did', () => {
	const submit = vi.fn()
	render(<ProductVariantsEditor product={product} disabled={false} onSubmit={submit} />)
	fireEvent.click(screen.getByRole('button', { name: 'Додати варіант' }))
	fireEvent.change(screen.getByLabelText('Значення нового варіанта'), { target: { value: '63' } })
	fireEvent.change(screen.getByLabelText('Ціна нового варіанта, грн'), {
		target: { value: '900' }
	})
	fireEvent.change(screen.getByLabelText('ID на Промі (необов’язково)'), {
		target: { value: '2647333298' }
	})
	fireEvent.change(screen.getByLabelText('Артикул вендора (необов’язково)'), {
		target: { value: 'ATS-63' }
	})
	fireEvent.click(screen.getByText('Створити новий варіант'))
	expect(submit.mock.calls[0][0].body.variant_action).toMatchObject({
		prom_id: '2647333298',
		vendor_product_sku: 'ATS-63'
	})
})
it('on a published product: «Редагувати» changes the status, a new variant is a draft by default', async () => {
	const submit = vi.fn()
	const published: TypedProduct = {
		...product,
		published: true,
		variants: [{ ...product.variants[0], status: 'active' }],
		details: {
			token: 'a'.repeat(64),
			description: null,
			variants: [{ id, price: 2400, stock: 2, weight_g: null, images: [] }]
		}
	}
	render(<ProductVariantsEditor product={published} disabled={false} onSubmit={submit} />)
	// The row shows what the old table showed; the whole SKU opens in one window.
	const row = screen.getByRole('row', { name: /FL-1/ })
	expect(row).toHaveTextContent('16 А')
	expect(row).toHaveTextContent('2400 ₴')
	expect(row).toHaveTextContent('Активний')
	expect(screen.queryByRole('button', { name: 'Архівувати FL-1' })).not.toBeInTheDocument()
	fireEvent.click(screen.getByRole('button', { name: 'Редагувати FL-1' }))
	fireEvent.change(screen.getByLabelText('Статус'), { target: { value: 'archived' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти варіант' }))
	await waitFor(() =>
		expect(submit).toHaveBeenLastCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					variant_action: { type: 'status', id, status: 'archived' }
				})
			})
		)
	)
	cleanup()
	render(<ProductVariantsEditor product={published} disabled={false} onSubmit={submit} />)
	fireEvent.click(screen.getByRole('button', { name: 'Додати варіант' }))
	// A draft unless «Активний» is chosen (owner, 2026-11-15).
	expect(screen.getByLabelText('Статус нового варіанта')).toHaveValue('draft')
	fireEvent.change(screen.getByLabelText('Значення нового варіанта'), { target: { value: '63' } })
	fireEvent.change(screen.getByLabelText('Ціна нового варіанта, грн'), {
		target: { value: '2500' }
	})
	fireEvent.click(screen.getByText('Створити новий варіант'))
	expect(submit).toHaveBeenLastCalledWith(
		expect.objectContaining({
			body: expect.objectContaining({
				variant_action: expect.objectContaining({
					type: 'add',
					variant_value: 63,
					status: 'draft'
				})
			})
		})
	)
})

it('archives every SKU at once, removes an inactive one after confirming, and the product last', () => {
	const second = '000000000000000000000002'
	const both: TypedProduct = {
		...product,
		published: true,
		variants: [
			{ ...product.variants[0], status: 'active' },
			{
				id: second,
				name: 'АВР — 32 А',
				variant_value: 32,
				sku: 'FL-2',
				slug: 'avr-32-a',
				status: 'archived'
			}
		]
	}
	const submit = vi.fn()
	render(<ProductVariantsEditor product={both} disabled={false} onSubmit={submit} />)
	// An active SKU is never removed directly, and blocks removing the product.
	expect(screen.queryByRole('button', { name: 'Видалити FL-1' })).not.toBeInTheDocument()
	expect(screen.getByRole('button', { name: 'Видалити товар' })).toBeDisabled()
	fireEvent.click(screen.getByRole('button', { name: 'Видалити FL-2' }))
	expect(submit).not.toHaveBeenCalled()
	fireEvent.click(screen.getByRole('button', { name: 'Так, видалити FL-2 назавжди' }))
	expect(submit.mock.calls[0][0].body.variant_action).toEqual({ type: 'delete', id: second })
	// One click takes nothing off the site: the question names how many SKUs are on sale now.
	const archive = screen.getByRole('button', { name: 'Архівувати всі варіанти' })
	fireEvent.click(archive)
	expect(submit).toHaveBeenCalledTimes(1)
	expect(screen.getByText(/1 активний варіант зникне з продажу на сайті/)).toBeVisible()
	// The question stands on its own row; the button just clicked is off, so a double click
	// lands on nothing.
	expect(archive).toBeDisabled()
	fireEvent.click(archive)
	expect(submit).toHaveBeenCalledTimes(1)
	fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
	expect(screen.queryByRole('button', { name: /^Так, архівувати/ })).not.toBeInTheDocument()
	expect(submit).toHaveBeenCalledTimes(1)
	fireEvent.click(screen.getByRole('button', { name: 'Архівувати всі варіанти' }))
	fireEvent.click(screen.getByRole('button', { name: 'Так, архівувати всі варіанти' }))
	expect(submit.mock.calls[1][0].body.variant_action).toEqual({ type: 'archive_all' })
	cleanup()
	render(
		<ProductVariantsEditor
			product={{
				...both,
				variants: both.variants.map(row => ({ ...row, status: 'archived' as const }))
			}}
			disabled={false}
			onSubmit={submit}
		/>
	)
	const remove = screen.getByRole('button', { name: 'Видалити товар' })
	fireEvent.click(remove)
	// The same for the product: the first button stays where it was, switched off.
	expect(remove).toBeDisabled()
	expect(submit).toHaveBeenCalledTimes(2)
	fireEvent.click(screen.getByRole('button', { name: 'Так, видалити «АВР» назавжди' }))
	expect(submit).toHaveBeenLastCalledWith({
		type: 'product-delete',
		id,
		body: { expected_revision: 2 }
	})
})
