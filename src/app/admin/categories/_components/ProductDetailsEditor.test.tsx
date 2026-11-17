import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { vi, it, expect, afterEach, describe } from 'vitest'
import {
	ProductDescriptionEditor,
	ProductPromotionEditor,
	ProductPurchaseNoticeEditor
} from './ProductDetailsEditor'
import { typedProductReadSchema, type TypedProduct } from '../typed-product.schema'
import { WithProductDrafts } from './category-drafts.test-utils'

/**
 * The product-wide cards beside the variants table: a promotion for every SKU, the purchase notice
 * and the description — drafts saved by the product header's one «Зберегти» (owner, 2026-11-09).
 * Each resends the stored rows unchanged and without promotion fields, so it never touches what it
 * does not edit. A single SKU's fields are in `VariantDialog.test.tsx`.
 */
vi.mock('../../products/_components/DescriptionBlock', () => ({
	DescriptionBlock: ({ onChange }: { onChange: (value: object) => void }) => (
		<>
			<button
				type='button'
				onClick={() => onChange({ html: '<p>Дуже тепла</p>', json: { ops: [1] } })}
			>
				Змінити опис
			</button>
			<button
				type='button'
				// A pasted screenshot is stored as text in the description: far past the limit.
				onClick={() => onChange({ html: 'x'.repeat(100001), json: { ops: [1] } })}
			>
				Вставити зображення в опис
			</button>
		</>
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
	variants: [
		{ id, name: 'Ковдра', sku: 'FL-1', slug: 'kovdra', variant_value: null },
		{ id: second, name: 'Ковдра 2', sku: 'FL-2', slug: 'kovdra-2', variant_value: null }
	],
	details: {
		token: 'a'.repeat(64),
		description: { html: '<p>Тепла</p>', json: { ops: [] } },
		variants: [
			{ id, price: 100, stock: 5, weight_g: 300, images: ['https://example.com/a.webp'] },
			{
				id: second,
				price: 200,
				stock: 1,
				weight_g: null,
				images: [],
				promo_percent: 10,
				promo_ends_at: '2999-01-01T00:00:00.000Z'
			}
		]
	}
}
afterEach(cleanup)

it('applies one promotion to every SKU at once and removes it from all', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductPromotionEditor product={product} disabled={false} />
		</WithProductDrafts>
	)
	expect(screen.getByText('Зараз діє на 1 з 2 варіантів')).toBeInTheDocument()
	fireEvent.change(screen.getByLabelText('Знижка для всіх, %'), { target: { value: '15' } })
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	const body = submit.mock.calls[0][0].body
	expect(body.details.token).toBe('a'.repeat(64))
	expect(body.details.description).toEqual(product.details!.description)
	expect(body.details.variants).toEqual([
		expect.objectContaining({ id, price: 100, promo_percent: 15, promo_ends_at: null }),
		expect.objectContaining({ id: second, price: 200, promo_percent: 15, promo_ends_at: null })
	])
	fireEvent.click(screen.getByRole('button', { name: 'Прибрати акцію з усіх' }))
	expect(screen.getByText('Після збереження акцію буде прибрано з усіх варіантів.')).toBeVisible()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit.mock.calls[1][0].body.details.variants).toEqual([
		expect.objectContaining({ id, promo_percent: null, promo_ends_at: null }),
		expect.objectContaining({ id: second, promo_percent: null, promo_ends_at: null })
	])
})

it('names the SKUs a product-wide promotion would sell below the purchase price, without blocking', () => {
	// What the shop pays: 90 ₴ for the first SKU (price 100), 150 ₴ for the second (price 200).
	const priced: TypedProduct = {
		...product,
		variants: [
			{ ...product.variants[0], supplier_price: 90 },
			{ ...product.variants[1], supplier_price: 150 }
		]
	}
	const submit = vi.fn()
	render(
		<WithProductDrafts product={priced} onSubmit={submit}>
			<ProductPromotionEditor product={priced} disabled={false} />
		</WithProductDrafts>
	)
	fireEvent.change(screen.getByLabelText('Знижка для всіх, %'), { target: { value: '5' } })
	expect(screen.queryByText(/Нижче закупівлі/)).not.toBeInTheDocument()
	fireEvent.change(screen.getByLabelText('Знижка для всіх, %'), { target: { value: '15' } })
	// 85 ₴ is under 90 ₴; the second SKU's 170 ₴ stays above its 150 ₴.
	const warning = screen.getByText(/Нижче закупівлі/)
	expect(warning).toHaveTextContent('FL-1 (≈85 ₴ < 90 ₴)')
	expect(warning).not.toHaveTextContent('FL-2')
	// The owner's call, made knowingly: the save goes through.
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).toHaveBeenCalledTimes(1)
})

it('refuses a percent outside 1–90 before sending', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductPromotionEditor product={product} disabled={false} />
		</WithProductDrafts>
	)
	fireEvent.change(screen.getByLabelText('Знижка для всіх, %'), { target: { value: '95' } })
	expect(screen.getByText('Відсоток акції — ціле число від 1 до 90.')).toBeInTheDocument()
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
	expect(screen.getByRole('alert')).toHaveTextContent('Відсоток акції — ціле число від 1 до 90.')
})

it('saves the description alone: prices, photos and promotions resent as stored', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductDescriptionEditor product={product} disabled={false} />
		</WithProductDrafts>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Змінити опис' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	const details = submit.mock.calls[0][0].body.details
	expect(details.description).toEqual({ html: '<p>Дуже тепла</p>', json: { ops: [1] } })
	expect(details.variants).toEqual([
		{
			id,
			price: 100,
			stock: 5,
			weight_g: 300,
			vendor_product_sku: null,
			prom_id: null,
			images: ['https://example.com/a.webp']
		},
		{
			id: second,
			price: 200,
			stock: 1,
			weight_g: null,
			vendor_product_sku: null,
			prom_id: null,
			images: []
		}
	])
	expect(submit.mock.calls[0][0].body).not.toHaveProperty('variant_action')
	// Omitted keeps the stored purchase notice: only its own card sends it.
	expect(details).not.toHaveProperty('purchase_notice')
})

it('says in the description block why a description cannot be saved, as a sentence', () => {
	const submit = vi.fn()
	render(
		<WithProductDrafts product={product} onSubmit={submit}>
			<ProductDescriptionEditor product={product} disabled={false} />
		</WithProductDrafts>
	)
	fireEvent.click(screen.getByRole('button', { name: 'Вставити зображення в опис' }))
	fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
	expect(submit).not.toHaveBeenCalled()
	const alert = screen.getByRole('alert')
	expect(alert).toHaveTextContent('Опис завеликий')
	expect(alert).not.toHaveTextContent('"code"')
})

describe('purchase notice (owner, 2026-11-05: product data, not the category’s)', () => {
	const stored = typedProductReadSchema.parse({
		...product,
		details: {
			...product.details,
			purchase_notice: {
				title: 'Рефіл без котушки',
				text: 'Потрібна власна котушка.',
				badge: 'Рефіл'
			}
		}
	})
	const mount = (value: TypedProduct = stored) => {
		const submit = vi.fn()
		render(
			<WithProductDrafts product={value} onSubmit={submit}>
				<ProductPurchaseNoticeEditor product={value} disabled={false} />
			</WithProductDrafts>
		)
		return submit
	}
	const save = () => fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

	it('reads the stored notice, saves the edit with the details as stored', () => {
		const submit = mount()
		expect(screen.getByLabelText('Заголовок')).toHaveValue('Рефіл без котушки')
		expect(screen.getByLabelText('Текст')).toHaveValue('Потрібна власна котушка.')
		expect(screen.getByLabelText('Напис на фото (необов’язково)')).toHaveValue('Рефіл')
		// Nothing edited, nothing to save.
		expect(screen.getByRole('button', { name: 'Зберегти' })).toBeDisabled()
		fireEvent.change(screen.getByLabelText('Текст'), {
			target: { value: ' Котушку купують окремо. ' }
		})
		fireEvent.change(screen.getByLabelText('Напис на фото (необов’язково)'), {
			target: { value: ' ' }
		})
		save()
		const { body } = submit.mock.calls[0][0]
		expect(body.details.purchase_notice).toEqual({
			title: 'Рефіл без котушки',
			text: 'Котушку купують окремо.',
			badge: null
		})
		expect(body.details.token).toBe('a'.repeat(64))
		expect(body.details.description).toEqual(product.details!.description)
		expect(body.details.variants.map((row: { id: string }) => row.id)).toEqual([id, second])
		expect(body.details.variants[1]).not.toHaveProperty('promo_percent')
	})

	it('removes the notice when all three fields are emptied', () => {
		const submit = mount()
		for (const label of ['Заголовок', 'Текст', 'Напис на фото (необов’язково)'])
			fireEvent.change(screen.getByLabelText(label), { target: { value: '' } })
		save()
		expect(submit.mock.calls[0][0].body.details.purchase_notice).toBeNull()
	})

	it('starts empty for a product without one', () => {
		const submit = mount(
			typedProductReadSchema.parse({
				...stored,
				details: { ...stored.details, purchase_notice: null }
			})
		)
		expect(screen.getByLabelText('Заголовок')).toHaveValue('')
		fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Увага' } })
		fireEvent.change(screen.getByLabelText('Текст'), { target: { value: 'Без котушки.' } })
		save()
		expect(submit.mock.calls[0][0].body.details.purchase_notice).toEqual({
			title: 'Увага',
			text: 'Без котушки.',
			badge: null
		})
	})

	it('refuses a title without text and a photo text alone, before a request', () => {
		const submit = mount(
			typedProductReadSchema.parse({
				...stored,
				details: { ...stored.details, purchase_notice: null }
			})
		)
		fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Увага' } })
		save()
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Заповніть і заголовок, і текст попередження — або залиште обидва порожніми.'
		)
		fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: '' } })
		fireEvent.change(screen.getByLabelText('Напис на фото (необов’язково)'), {
			target: { value: 'Рефіл' }
		})
		save()
		expect(screen.getByRole('alert')).toHaveTextContent(
			'Напис на фото показується лише разом із заголовком і текстом.'
		)
		expect(submit).not.toHaveBeenCalled()
	})
})
