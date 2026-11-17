import type { TypedDefinition, TypedProduct } from '../typed-product.schema'
import { ui } from './admin-ui'

/** The shop's readiness check (the backend's `productReadiness`) in the admin's words, by code. */
const messages: Record<string, string> = {
	REQUIRED_ATTRIBUTE: 'Заповніть обов’язкову характеристику',
	DESCRIPTION_REQUIRED: 'Додайте опис товару',
	DRAFT_VARIANT_REQUIRED: 'Додайте або відновіть хоча б один варіант',
	POSITIVE_PRICE_REQUIRED: 'Вкажіть ціну більшу за нуль',
	VALID_STOCK_REQUIRED: 'Вкажіть коректний залишок',
	IMAGE_REQUIRED: 'Додайте фото варіанта',
	SHIPPING_WEIGHT_UNKNOWN: 'Вага для розрахунку доставки не вказана'
}
type Issue = { code: string; field: string; variant_id?: string }
const issueText = (product: TypedProduct, issue: Issue) => {
	const variant = product.variants.find(row => row.id === issue.variant_id)
	const definition = product.definitions.find(row => row.key === issue.field)
	return `${messages[issue.code] ?? issue.code}${definition ? `: ${definition.label}` : ''}${variant ? ` · ${variant.sku}` : ''}`
}

/**
 * What a SKU asked to go on sale still lacks (owner, 2026-11-15: «активний — коли повний») — the
 * server's rule, said before the request in the words of «Готовність даних товару»: the product's
 * description and required characteristics, and for the SKU itself a price above zero and a photo.
 * The server refuses the same with `PRODUCT_NOT_READY`.
 */
export function skuGaps(name: string, sku: { price: number; photos: number }) {
	return [
		...(sku.price > 0 ? [] : [`${messages.POSITIVE_PRICE_REQUIRED} · ${name}`]),
		...(sku.photos > 0 ? [] : [`${messages.IMAGE_REQUIRED} · ${name}`])
	]
}
/** The product's own gaps as the server reported them with the product (not a SKU's). */
export function productGaps(product: TypedProduct) {
	return (product.readiness?.issues ?? [])
		.filter(issue => !issue.variant_id)
		.map(issue => issueText(product, issue))
}
/** The same for a product that is only being created: nothing is stored yet. */
export function newProductGaps(input: {
	definitions: TypedDefinition[]
	attributes: { k: string }[]
	axisKey: string | undefined
	/** The description's HTML as the editor holds it. */
	description: string
}) {
	const text = input.description
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(?:nbsp|#160|#xA0);/gi, ' ')
		.trim()
	return [
		...input.definitions
			.filter(
				definition =>
					definition.is_required &&
					definition.key !== input.axisKey &&
					!input.attributes.some(row => row.k === definition.key)
			)
			.map(definition => `${messages.REQUIRED_ATTRIBUTE}: ${definition.label}`),
		...(text ? [] : [messages.DESCRIPTION_REQUIRED])
	]
}
/** The gaps as the forms show them: what to fill, or keep the draft. */
export function ActivationGaps({ gaps }: { gaps: string[] }) {
	if (!gaps.length) return null
	return (
		<div role='alert' className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
			<p>Активним товар стає, коли він повний. Бракує:</p>
			<ul className='list-disc pl-5'>
				{gaps.map(gap => (
					<li key={gap}>{gap}</li>
				))}
			</ul>
			<p>Заповніть це або залиште статус «Чернетка».</p>
		</div>
	)
}

export function ProductReadiness({ product }: { product: TypedProduct }) {
	const report = product.readiness
	if (!report) return null
	const label = (issue: Issue) => issueText(product, issue)
	return (
		<section
			aria-label='Готовність даних товару'
			className={`min-w-0 space-y-2 rounded-lg border p-4 ${report.data_ready ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}
		>
			<div className='flex flex-wrap items-center gap-2'>
				<h3 className='text-sm font-semibold text-gray-900'>Готовність даних товару</h3>
				<span
					className={`${ui.badge} ${report.data_ready ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}
				>
					{report.data_ready ? 'Готово' : `Бракує: ${report.issues.length}`}
				</span>
			</div>
			<p className='text-sm'>
				{report.data_ready
					? 'Основні дані заповнені.'
					: 'Перед публікацією потрібно доповнити дані:'}
			</p>
			{report.issues.length > 0 && (
				<ul className='list-disc space-y-1 pl-5 text-sm'>
					{report.issues.map((item, index) => (
						<li key={index}>{label(item)}</li>
					))}
				</ul>
			)}
			{report.warnings.length > 0 && (
				<ul className='list-disc space-y-1 pl-5 text-sm text-amber-800'>
					{report.warnings.map((item, index) => (
						<li key={index}>{label(item)}</li>
					))}
				</ul>
			)}
			<p className='text-xs text-gray-500'>
				Перевірка враховує збережені дані за правилами магазину. Це не перевірка Google чи
				Merchant Center.
			</p>
		</section>
	)
}
