'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@/common/components/ui/dialog'
import { ImageDropzone, type ImageUploadItem } from '../../products/_components/ImageDropzone'
import { productsApi } from '../../products/products.api'
import type { CategoryCommand } from '../category-tree.api'
import {
	parseField,
	supplierIdInput,
	type TypedProduct,
	type TypedProductBody
} from '../typed-product.schema'
import { productBody, storedDescription, storedDetailRows } from '../typed-product-body'
import { fromDateTimeLocal } from '@/common/utils/date.utils'
import { PromoPreview, promoError, promoFields } from './ProductDetailsEditor'
import { problemText } from './product-drafts'
import { ActivationGaps, productGaps, skuGaps } from './ProductReadiness'
import { SlugChange } from './SlugChange'
import { ValueInput } from './TypedValueInput'
import { ui } from './admin-ui'

export type VariantTarget = { mode: 'add' } | { mode: 'edit'; id: string }
type Status = 'draft' | 'active' | 'archived'
type Action = NonNullable<TypedProductBody['variant_action']>
/** The window's plain fields, as typed text. */
interface Fields {
	value: string
	price: string
	stock: string
	weight: string
	vendorSku: string
	promId: string
	status: Status
}
const STATUS_LABELS: Record<Status, string> = {
	active: 'Активний',
	draft: 'Чернетка',
	archived: 'Архівний'
}

/**
 * One SKU in one window, as the old admin's variant modal: value, price, stock, weight, supplier
 * ids, status, promotion and photos — saved together in one write (the typed draft PATCH takes
 * the axis values, the `details` and one `variant_action` at once). Its address changes on its
 * own (a redirect-backed operation). A new SKU is `variant_action: add` with the same block,
 * photos included (uploaded on submit); it is a draft unless «Активний» is chosen, and a SKU goes
 * active only in a complete product (owner, 2026-11-15) — the window names what is missing.
 */
export function VariantDialog({
	product,
	target,
	disabled,
	failure = '',
	onClose,
	onSubmit
}: {
	product: TypedProduct
	target: VariantTarget
	disabled: boolean
	/** The page's status line: after a refused save it is the reason, and the window covers it. */
	failure?: string
	onClose: () => void
	onSubmit: (command: CategoryCommand) => void
}) {
	const adding = target.mode === 'add'
	const variant = adding ? null : product.variants.find(row => row.id === target.id)!
	const detail = adding ? null : product.details?.variants.find(row => row.id === target.id)
	const axis = product.definitions.find(def => def.key === product.variant_axis?.key)
	const published = product.published === true
	const stored = (variant?.status ?? 'draft') as Status
	// The SKU as the product holds it now (a new one: the form's blanks).
	const fresh: Fields = {
		value: variant?.variant_value == null ? '' : String(variant.variant_value),
		price: detail ? String(detail.price) : '',
		stock: detail ? String(detail.stock) : '0',
		weight: detail?.weight_g == null ? '' : String(detail.weight_g),
		vendorSku: detail?.vendor_product_sku ?? '',
		promId: detail?.prom_id ?? '',
		// A new SKU is a draft unless «Активний» is chosen (owner, 2026-11-15).
		status: adding ? 'draft' : stored
	}
	// Only what the admin typed is kept; an untouched field shows the product as it is stored now.
	// A save refused because the Prom sync has just rewritten the price or the stock
	// (PRODUCT_DETAILS_CHANGED) is followed by a fresh read of the product, and the next attempt
	// must carry those figures — never write the ones this window opened with back over them.
	const [edits, setEdits] = useState<Partial<Fields>>({})
	const { value, price, stock, weight, vendorSku, promId, status } = { ...fresh, ...edits }
	const edit =
		<K extends keyof Fields>(key: K) =>
		(next: Fields[K]) =>
			setEdits(previous => ({ ...previous, [key]: next }))
	const [promo, setPromo] = useState(() => promoFields(detail ?? {}))
	const storedImages: ImageUploadItem[] =
		detail?.images.map((publicUrl, index) => ({
			id: `${target.mode === 'edit' ? target.id : 'new'}-${index}`,
			status: 'uploaded' as const,
			publicUrl
		})) ?? []
	// `null` until the admin adds, removes or reorders a photo.
	const [imageEdits, setImageEdits] = useState<ImageUploadItem[] | null>(null)
	const images = imageEdits ?? storedImages
	const dirty =
		(Object.keys(edits) as (keyof Fields)[]).some(key => edits[key] !== fresh[key]) ||
		imageEdits !== null ||
		promo.promo_touched
	const [error, setError] = useState('')
	// What the product still lacks for this SKU to go on sale, when «Активний» was asked.
	const [gaps, setGaps] = useState<string[]>([])
	const [saving, setSaving] = useState(false)
	// A save in flight makes the workspace busy; busy ending without the editor remounting on a
	// new revision means the save was refused — the reason is in the page's status line.
	const sawBusy = useRef(false)
	useEffect(() => {
		if (!saving) return
		if (disabled) sawBusy.current = true
		else if (sawBusy.current) {
			sawBusy.current = false
			setSaving(false)
			setError(
				failure
					? `Не збережено. ${failure}`
					: 'Не збережено — причина в повідомленні над сторінкою. Дані у вікні збережені.'
			)
		}
	}, [disabled, saving, failure])
	const statuses: Status[] = adding
		? published
			? ['draft', 'active']
			: ['draft']
		: published
			? ['active', 'draft', 'archived']
			: stored === 'active'
				? ['active', 'archived']
				: ['draft', 'archived']
	const statusAction = (id: string): Action | null => {
		if (status === stored) return null
		if (published) return { type: 'status', id, status }
		return status === 'archived' ? { type: 'archive', id } : { type: 'restore', id }
	}
	async function upload() {
		const urls: string[] = []
		for (const image of images) {
			if (image.status === 'uploaded' && image.publicUrl) {
				urls.push(image.publicUrl)
				continue
			}
			if (!image.file) throw Error('Не вдалося прочитати фото. Додайте його повторно.')
			const [publicUrl] = await productsApi.uploadImages(product.product_id, [image.file])
			if (!publicUrl) throw Error('Завантаження не повернуло адресу фото.')
			const uploaded: ImageUploadItem = { ...image, status: 'uploaded', publicUrl }
			setImageEdits(previous =>
				(previous ?? images).map(item => (item.id === image.id ? uploaded : item))
			)
			urls.push(publicUrl)
		}
		return urls
	}
	async function submit(event: FormEvent) {
		event.preventDefault()
		if (disabled || saving) return
		setError('')
		setGaps([])
		try {
			let parsed: string | number | boolean | null = null
			if (axis) {
				parsed = parseField(axis, value)
				if (parsed === null) throw Error('Заповніть значення варіанта.')
				if (
					product.variants.some(
						row => row.id !== variant?.id && row.variant_value === parsed
					)
				)
					throw Error(
						adding
							? 'Таке значення вже існує. Архівний варіант можна відновити.'
							: 'Таке значення вже має інший варіант.'
					)
			}
			if (!price.trim() || !stock.trim()) throw Error('Заповніть ціну та залишок.')
			const weight_g = weight.trim() ? Number(weight) : null
			if (images.length > 30) throw Error('Для одного варіанта дозволено до 30 фото.')
			// A SKU goes on sale only in a complete product (owner, 2026-11-15): the gaps are named
			// here, in the words of «Готовність даних товару»; the server refuses the same. A SKU that
			// is active already is saved as before.
			if (published && status === 'active' && (adding || stored !== 'active')) {
				const missing = [
					...productGaps(product),
					...skuGaps(adding ? 'новий варіант' : variant!.sku, {
						price: Number(price),
						photos: images.length
					})
				]
				if (missing.length) return setGaps(missing)
			}
			if (adding) {
				if (!axis) throw Error('Спочатку налаштуйте вісь варіантів.')
				// Photos picked for the new SKU go up first; with none the command leaves at once.
				const pending = images.some(item => item.status !== 'uploaded' || !item.publicUrl)
				if (pending) setSaving(true)
				const urls = pending ? await upload() : images.map(item => item.publicUrl!)
				const body = productBody(product, {
					variant_action: {
						type: 'add',
						variant_value: parsed!,
						price: Number(price),
						stock: Number(stock),
						weight_g,
						// Blank = our SKU as the article, no Prom link (as the old variant form).
						vendor_product_sku: supplierIdInput(vendorSku),
						prom_id: supplierIdInput(promId),
						...(urls.length ? { images: urls } : {}),
						...(published ? { status: status as 'active' | 'draft' } : {})
					}
				})
				onSubmit({ type: 'product', id: product.product_id, body })
				setSaving(true)
				return
			}
			if (!product.details) throw Error('Дані цін і фото не завантажилися. Оновіть сторінку.')
			if (promoError(promo.promo_percent))
				throw Error('Відсоток акції — ціле число від 1 до 90.')
			if (promo.promo_ends_at && !promo.promo_percent)
				throw Error('Дата завершення акції потребує відсотка.')
			setSaving(true)
			const urls = await upload()
			const id = variant!.id
			const action = statusAction(id)
			const body = productBody(product, {
				variants: product.variants.map(row => ({
					id: row.id,
					variant_value: row.id === id && axis ? parsed : row.variant_value
				})),
				details: {
					token: product.details.token,
					description: storedDescription(product),
					variants: storedDetailRows(product).map(row =>
						row.id === id
							? {
									...row,
									price: Number(price),
									stock: Number(stock),
									weight_g,
									vendor_product_sku: supplierIdInput(vendorSku),
									prom_id: supplierIdInput(promId),
									images: urls,
									...(promo.promo_touched
										? {
												promo_percent: promo.promo_percent
													? Number(promo.promo_percent)
													: null,
												promo_ends_at:
													promo.promo_percent && promo.promo_ends_at
														? fromDateTimeLocal(promo.promo_ends_at)
														: null
											}
										: {})
								}
							: row
					)
				},
				...(action ? { variant_action: action } : {})
			})
			onSubmit({ type: 'product', id: product.product_id, body })
		} catch (cause) {
			setSaving(false)
			setError(problemText(cause, 'Перевірте дані варіанта.'))
		}
	}
	return (
		<Dialog open onOpenChange={open => !open && !saving && onClose()}>
			<DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-2xl'>
				<DialogHeader>
					<DialogTitle>
						{adding ? 'Новий варіант' : `Редагування варіанта ${variant!.sku}`}
					</DialogTitle>
					<DialogDescription className='break-all'>
						{adding
							? 'Артикул і адреса з’являться після створення.'
							: `/products/${variant!.slug}`}
					</DialogDescription>
				</DialogHeader>
				<form
					aria-label={adding ? 'Новий варіант' : `Редагування ${variant!.sku}`}
					onSubmit={submit}
					className='min-w-0 space-y-5'
				>
					<fieldset disabled={disabled || saving} className='min-w-0 space-y-5'>
						{axis && (
							<div className='min-w-0'>
								<p className='text-sm font-medium text-gray-700'>
									{axis.label}
									{axis.unit ? ` (${axis.unit})` : ''}
								</p>
								<ValueInput
									definition={axis}
									label={
										adding
											? 'Значення нового варіанта'
											: `Варіант ${variant!.sku}`
									}
									hideLabel
									value={value}
									onChange={edit('value')}
								/>
							</div>
						)}
						<div className='grid min-w-0 gap-3 sm:grid-cols-3'>
							{[
								{
									text: adding ? 'Ціна нового варіанта, грн' : 'Ціна, грн',
									value: price,
									set: edit('price'),
									min: 0,
									step: 'any',
									placeholder: '0.00',
									hint: null
								},
								{
									text: adding ? 'Залишок нового варіанта' : 'Залишок',
									value: stock,
									set: edit('stock'),
									min: 0,
									step: '1',
									placeholder: '0',
									hint: null
								},
								{
									// The parcel, not the product: Nova Post's rate and `shipping_weight`
									// come from it, as the old admin's «Вага для пошти» said.
									text: adding
										? 'Вага для пошти нового варіанта, г'
										: 'Вага для пошти, г',
									value: weight,
									set: edit('weight'),
									min: 1,
									step: '1',
									placeholder: 'напр. 1220',
									hint: 'Посилка з упаковкою'
								}
							].map(field => (
								<div key={field.text} className='min-w-0 space-y-1'>
									<label className={ui.label}>
										{field.text}
										<input
											className={ui.input}
											type='number'
											min={field.min}
											step={field.step}
											placeholder={field.placeholder}
											value={field.value}
											onChange={event => field.set(event.target.value)}
										/>
									</label>
									{field.hint && <p className={ui.hint}>{field.hint}</p>}
								</div>
							))}
						</div>
						<div className='grid min-w-0 gap-3 sm:grid-cols-2'>
							<label className={ui.label}>
								Артикул вендора (необов’язково)
								<input
									className={ui.input}
									maxLength={100}
									placeholder='Артикул у системі вендора'
									value={vendorSku}
									onChange={event => edit('vendorSku')(event.target.value)}
								/>
							</label>
							<label className={ui.label}>
								ID на Промі (необов’язково)
								<input
									className={ui.input}
									maxLength={100}
									placeholder='Напр. 3012625429'
									value={promId}
									onChange={event => edit('promId')(event.target.value)}
								/>
							</label>
						</div>
						{statuses.length > 1 && (
							<label className={`${ui.label} sm:w-1/2`}>
								{adding ? 'Статус нового варіанта' : 'Статус'}
								<select
									className={ui.input}
									value={status}
									onChange={event => {
										edit('status')(event.target.value as Status)
										setGaps([])
									}}
								>
									{statuses.map(item => (
										<option key={item} value={item}>
											{STATUS_LABELS[item]}
											{item === 'active' && published ? ' — на сайті' : ''}
										</option>
									))}
								</select>
							</label>
						)}
						{!adding && (
							<div className='grid min-w-0 gap-3 rounded-md bg-gray-50 p-3 sm:grid-cols-2'>
								<div className='min-w-0 space-y-1'>
									<label className={ui.label}>
										Акція, %
										<input
											className={ui.input}
											type='number'
											min={1}
											max={90}
											step={1}
											placeholder='напр. 15'
											value={promo.promo_percent}
											onChange={event =>
												setPromo(previous => ({
													...previous,
													promo_percent: event.target.value,
													promo_touched: true
												}))
											}
										/>
									</label>
									<p className={ui.hint}>Порожнє поле — акції немає</p>
								</div>
								<div className='min-w-0 space-y-1'>
									<label className={ui.label}>
										Акція до (необов’язково)
										<input
											className={ui.input}
											type='datetime-local'
											value={promo.promo_ends_at}
											onChange={event =>
												setPromo(previous => ({
													...previous,
													promo_ends_at: event.target.value,
													promo_touched: true
												}))
											}
										/>
									</label>
									<p className={ui.hint}>
										Діє лише разом із відсотком; порожнє — без дати завершення
									</p>
								</div>
								<PromoPreview
									price={price}
									percent={promo.promo_percent}
									supplierPrice={variant?.supplier_price ?? null}
									ended={promo.promo_touched ? null : promo.promo_ended}
								/>
							</div>
						)}
						{/* A new SKU has the same block as an existing one, photos included. */}
						<div className='min-w-0 space-y-2'>
							<p className='text-sm font-medium text-gray-700'>
								Фото{' '}
								<span className='font-normal text-gray-500'>
									(перше — головне, порядок — перетягуванням)
								</span>
							</p>
							<ImageDropzone images={images} onChange={setImageEdits} />
						</div>
						{adding && (
							<p className={ui.hint}>
								{published && status === 'active'
									? 'Активний варіант з’явиться на сайті одразу.'
									: 'Новий варіант збережеться як чернетка.'}
							</p>
						)}
					</fieldset>
					<ActivationGaps gaps={gaps} />
					{error && (
						<p role='alert' className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
							{error}
						</p>
					)}
					<div className='flex flex-wrap justify-end gap-2 border-t pt-4'>
						<button
							type='button'
							className={ui.button}
							disabled={saving}
							onClick={onClose}
						>
							Скасувати
						</button>
						<button type='submit' className={ui.primary} disabled={disabled || saving}>
							{saving
								? 'Збереження…'
								: adding
									? 'Створити новий варіант'
									: 'Зберегти варіант'}
						</button>
					</div>
				</form>
				{!adding && (
					<div className='space-y-2 border-t pt-4'>
						<p className='text-sm font-medium text-gray-700'>Адреса сторінки</p>
						<p className={ui.hint}>
							Звичайне перейменування адресу не змінює. Зміна адреси — окрема дія:
							стара адреса перенаправлятиме на нову.
						</p>
						<SlugChange
							target='variants'
							id={variant!.id}
							slug={variant!.slug}
							prefix='/products/'
							revision={product.revision}
							disabled={disabled || saving || dirty}
							onSubmit={onSubmit}
						/>
						{dirty && (
							<p className={ui.hint}>
								Спершу збережіть зміни варіанта: зміна адреси закриє це вікно.
							</p>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
