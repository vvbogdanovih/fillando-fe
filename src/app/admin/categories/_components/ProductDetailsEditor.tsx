'use client'
import { useRef } from 'react'
import {
	DescriptionBlock,
	type DescriptionValue
} from '../../products/_components/DescriptionBlock'
import { previewSalePrice } from '../../products/products.schema'
import type { TypedProduct } from '../typed-product.schema'
import { storedDescription } from '../typed-product-body'
import { formatAdminDateTime, toDateTimeLocal } from '@/common/utils/date.utils'
import { ui } from './admin-ui'
import { productScope, useCategoryDraft, useDraftIssue } from './category-drafts'
import {
	NO_PROMOTION,
	promoError,
	type DescriptionDraft,
	type NoticeDraft,
	type PromotionDraft
} from './product-drafts'

export { promoError }

/**
 * A stored promotion as the form shows it (TD-0012, as the old VariantModal): a configured one
 * that has not ended is prefilled; an ended one is not — its past date would be refused — and is
 * only named, so the admin knows why the fields are empty.
 */
export function promoFields(row: { promo_percent?: number | null; promo_ends_at?: string | null }) {
	const ended = !!row.promo_ends_at && Date.parse(row.promo_ends_at) <= Date.now()
	const live = row.promo_percent != null && !ended
	return {
		promo_percent: live ? String(row.promo_percent) : '',
		promo_ends_at: live ? toDateTimeLocal(row.promo_ends_at) : '',
		promo_ended: row.promo_percent != null && ended ? (row.promo_ends_at ?? null) : null,
		/** Only a row the admin touched sends its promotion; the rest keep what is stored. */
		promo_touched: false
	}
}

/**
 * The product's description — a draft of the page, saved by the header's «Зберегти» with the rest
 * (owner, 2026-11-09). The block is the old admin's «Опис» card.
 */
export function ProductDescriptionEditor({
	product,
	disabled
}: {
	product: TypedProduct
	disabled: boolean
}) {
	const [description, setDescription] = useCategoryDraft<DescriptionDraft>(
		productScope(product.product_id),
		'description',
		storedDescription(product)
	)
	const ref = useRef<DescriptionValue | null>(description)
	const issue = useDraftIssue(productScope(product.product_id), 'description')
	if (!product.details) return null
	return (
		<section aria-label='Опис товару' className='min-w-0 space-y-2'>
			<div className={disabled ? 'pointer-events-none opacity-60' : ''} inert={disabled}>
				<DescriptionBlock
					descriptionRef={ref}
					initialValue={description ?? undefined}
					onChange={setDescription}
				/>
			</div>
			{issue && (
				<p role='alert' className='text-sm break-words text-red-700'>
					{issue.message}
				</p>
			)}
		</section>
	)
}

/**
 * The product's purchase notice (owner, 2026-11-05): a warning above «В кошик» on this product's
 * page only, its optional short text over the photo; three empty fields remove it. A draft of the
 * page, saved by the header's «Зберегти» (owner, 2026-11-09).
 */
export function ProductPurchaseNoticeEditor({
	product,
	disabled
}: {
	product: TypedProduct
	disabled: boolean
}) {
	const stored = product.details?.purchase_notice ?? null
	const [notice, setNotice] = useCategoryDraft<NoticeDraft>(
		productScope(product.product_id),
		'notice',
		{ title: stored?.title ?? '', text: stored?.text ?? '', badge: stored?.badge ?? '' }
	)
	const issue = useDraftIssue(productScope(product.product_id), 'notice')
	if (!product.details) return null
	return (
		<PurchaseNoticeFields
			notice={notice}
			onChange={setNotice}
			disabled={disabled}
			issue={issue?.message}
		/>
	)
}

/**
 * The notice's card and fields: the edit screen keeps them as a draft of the page, the creation
 * form in its own state («усе одразу», owner 2026-11-15) — one block, never a second copy.
 */
export function PurchaseNoticeFields({
	notice,
	onChange,
	disabled,
	issue,
	optional = false
}: {
	notice: NoticeDraft
	onChange: (notice: NoticeDraft) => void
	disabled: boolean
	issue?: string
	/** The creation form says the block may be left empty. */
	optional?: boolean
}) {
	const setNotice = onChange
	return (
		<section aria-label='Попередження перед покупкою' className={ui.card}>
			<div>
				<h3 className={ui.cardTitle}>
					Попередження перед покупкою{optional ? ' (необов’язково)' : ''}
				</h3>
				<p className={ui.hint}>
					Показується над кнопкою «В кошик» лише в цього товару, напис — поверх фото.
				</p>
			</div>
			<fieldset disabled={disabled} className='grid min-w-0 gap-3'>
				<label className={ui.label}>
					Заголовок
					<input
						className={ui.input}
						maxLength={120}
						placeholder='Наприклад: Постачається без зарядного пристрою'
						value={notice.title}
						onChange={event => setNotice({ ...notice, title: event.target.value })}
					/>
				</label>
				<label className={ui.label}>
					Текст
					<textarea
						className={ui.textarea}
						rows={3}
						maxLength={1000}
						value={notice.text}
						onChange={event => setNotice({ ...notice, text: event.target.value })}
					/>
				</label>
				<label className={`${ui.label} max-w-sm`}>
					Напис на фото (необов’язково)
					<input
						className={ui.input}
						maxLength={40}
						placeholder='Наприклад: Без зарядного пристрою'
						value={notice.badge}
						onChange={event => setNotice({ ...notice, badge: event.target.value })}
					/>
				</label>
			</fieldset>
			{issue && (
				<p role='alert' className='text-sm break-words text-red-700'>
					{issue}
				</p>
			)}
		</section>
	)
}

/**
 * One promotion for every SKU at once (the old admin's «Акція» card). A draft of the page, saved by
 * the header's «Зберегти» (owner, 2026-11-09): a percent puts it on every SKU, «Прибрати акцію з
 * усіх» takes it off every SKU. A single SKU's promotion is edited in its variant window.
 */
export function ProductPromotionEditor({
	product,
	disabled
}: {
	product: TypedProduct
	disabled: boolean
}) {
	const [promotion, setPromotion] = useCategoryDraft<PromotionDraft>(
		productScope(product.product_id),
		'promotion',
		NO_PROMOTION
	)
	const issue = useDraftIssue(productScope(product.product_id), 'promotion')
	if (!product.details) return null
	const active = product.details.variants.filter(row => promoFields(row).promo_percent).length
	// The shop resells at the supplier's price plus a small markup, so a promotion easily dips
	// below cost. Named, never blocked — the owner's call, but not one to make unknowingly (as the
	// old admin's «Акція» card did).
	const percent = Number(promotion.percent)
	const belowCost =
		promotion.percent && !promoError(promotion.percent) && !promotion.remove
			? product.details.variants.flatMap(row => {
					const variant = product.variants.find(item => item.id === row.id)
					const sale = previewSalePrice(row.price, percent)
					return variant?.supplier_price != null && sale < variant.supplier_price
						? [`${variant.sku} (≈${sale} ₴ < ${variant.supplier_price} ₴)`]
						: []
				})
			: []
	return (
		<section aria-label='Акція на весь товар' className={ui.card}>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<h3 className={ui.cardTitle}>Акція на весь товар</h3>
				<span className={ui.hint}>
					{active
						? `Зараз діє на ${active} з ${product.details.variants.length} варіантів`
						: 'Зараз акцій немає'}
				</span>
			</div>
			<p className={ui.hint}>
				Однакова знижка для всіх варіантів. Акцію одного варіанта змінюють у його вікні
				«Редагувати».
			</p>
			<fieldset
				disabled={disabled || promotion.remove}
				className='flex min-w-0 flex-wrap items-end gap-3 [&>label]:w-40 [&>label:nth-child(2)]:w-60'
			>
				<label className={ui.label}>
					Знижка для всіх, %
					<input
						className={ui.input}
						type='number'
						min={1}
						max={90}
						step={1}
						placeholder='напр. 15'
						value={promotion.percent}
						onChange={event =>
							setPromotion({ ...promotion, percent: event.target.value })
						}
					/>
				</label>
				<label className={ui.label}>
					Для всіх до (необов’язково)
					<input
						className={ui.input}
						type='datetime-local'
						value={promotion.ends}
						onChange={event => setPromotion({ ...promotion, ends: event.target.value })}
					/>
				</label>
			</fieldset>
			<div className='flex flex-wrap items-center gap-3'>
				<button
					type='button'
					className={ui.button}
					disabled={disabled || (!active && !promotion.remove)}
					onClick={() =>
						setPromotion(
							promotion.remove ? NO_PROMOTION : { ...NO_PROMOTION, remove: true }
						)
					}
				>
					{promotion.remove ? 'Не прибирати акцію' : 'Прибрати акцію з усіх'}
				</button>
				{promotion.remove && (
					<p className='text-sm text-amber-700'>
						Після збереження акцію буде прибрано з усіх варіантів.
					</p>
				)}
			</div>
			{!issue && promotion.percent && promoError(promotion.percent) && (
				<p className='text-sm text-amber-700'>Відсоток акції — ціле число від 1 до 90.</p>
			)}
			{belowCost.length > 0 && (
				<p role='status' className='text-sm break-words text-amber-700'>
					Нижче закупівлі: {belowCost.join(', ')}. Зберегти можна, але магазин продаватиме
					собі у збиток.
				</p>
			)}
			{issue && (
				<p role='alert' className='text-sm break-words text-red-700'>
					{issue.message}
				</p>
			)}
		</section>
	)
}

/** Sale price preview and the below-cost warning (never a block), as the old variant form. */
export function PromoPreview({
	price,
	percent,
	supplierPrice,
	ended
}: {
	price: string
	percent: string
	supplierPrice: number | null
	ended: string | null
}) {
	const base = Number(price)
	const valid = !!percent && !promoError(percent) && Number.isFinite(base) && base > 0
	const sale = valid ? previewSalePrice(base, Number(percent)) : null
	return (
		<p className='text-sm sm:col-span-2'>
			{ended && !percent && (
				<span className='block text-gray-500'>
					Акція завершилась {formatAdminDateTime(ended)}. Для нової вкажіть відсоток.
				</span>
			)}
			{sale !== null &&
				(sale > 0 && sale < base ? (
					<span className='block'>Ціна за акцією: {sale} ₴</span>
				) : (
					<span className='block text-amber-700'>
						Знижка округлюється до нуля — акції не буде.
					</span>
				))}
			{sale !== null && supplierPrice !== null && sale < supplierPrice && (
				<span className='block text-amber-700'>
					Нижче закупівельної ціни ({supplierPrice} ₴).
				</span>
			)}
		</p>
	)
}
