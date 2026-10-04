'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter
} from '@/common/components/ui/dialog'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { ColorSelect } from './ColorSelect'
import { Button } from '@/common/components/ui/button'
import { Badge } from '@/common/components/ui/badge'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { ImageDropzone, type ImageUploadItem } from './ImageDropzone'
import { WeightInfoNote } from './WeightInfoNote'
import { productsApi } from '../products.api'
import {
	previewSalePrice,
	promoStateOf,
	variantEditFormSchema,
	type VariantEditFormValues,
	type ProductVariantFull
} from '../products.schema'
import { formatAdminDateTime, fromDateTimeLocal, toDateTimeLocal } from '@/common/utils/date.utils'

interface VariantModalProps {
	open: boolean
	mode: 'add' | 'edit'
	variant?: ProductVariantFull
	productId: string
	hasVariants: boolean
	/** Value of the variant-type attribute at the product level (used to seed the first variant) */
	variantTypeAttrValue?: string
	/** Whether at least one variant already exists for this product */
	hasExistingVariants?: boolean
	onClose: () => void
	onSuccess: () => void
}

export const VariantModal = ({
	open,
	mode,
	variant,
	productId,
	hasVariants,
	variantTypeAttrValue,
	hasExistingVariants,
	onClose,
	onSuccess
}: VariantModalProps) => {
	const isEdit = mode === 'edit'
	// v_value is locked when adding the first variant — its value is the product attribute's value
	const isVValueLocked = !isEdit && hasVariants && !hasExistingVariants && !!variantTypeAttrValue

	const [imageUploads, setImageUploads] = useState<ImageUploadItem[]>([])

	const {
		register,
		control,
		handleSubmit,
		reset,
		setError,
		watch,
		formState: { errors, isSubmitting }
	} = useForm<VariantEditFormValues>({
		resolver: zodResolver(variantEditFormSchema)
	})

	// The below-cost warning follows the fields as they are typed (TD-0012): what the shop pays
	// is `supplier_price` from the admin response, what it would charge is the preview.
	const watchedPrice = Number(watch('price'))
	const watchedPercent = Number(watch('promo_percent'))
	const supplierPrice = isEdit ? (variant?.supplier_price ?? null) : null
	const endedPromo = isEdit && variant && promoStateOf(variant) === 'ended' ? variant : null
	const previewedSale =
		watchedPercent >= 1 && watchedPercent <= 90 && watchedPrice > 0
			? previewSalePrice(watchedPrice, watchedPercent)
			: null
	const belowCost =
		supplierPrice != null && previewedSale != null && previewedSale < supplierPrice

	// Reset form and images when modal opens or switches variant
	useEffect(() => {
		if (!open) return

		if (isEdit && variant) {
			// Preserve configured discounts even when today's price rounds away the saving.
			// A price edit or a later Prom sync can make them effective. Only expired dates
			// must stay out of the form, because the backend refuses to save them again.
			const hasConfiguredPromo =
				variant.promo_percent != null &&
				(!variant.promo_ends_at || Date.parse(variant.promo_ends_at) > Date.now())
			reset({
				price: String(variant.price),
				stock: String(variant.stock),
				v_value: variant.v_value,
				status: variant.status,
				vendor_product_sku: variant.vendor_product_sku ?? '',
				prom_id: variant.prom_id ?? '',
				color_id: variant.color_id ?? null,
				weight_g: variant.weight_g != null ? String(variant.weight_g) : '',
				promo_percent: hasConfiguredPromo ? String(variant.promo_percent) : '',
				promo_ends_at: hasConfiguredPromo ? toDateTimeLocal(variant.promo_ends_at) : ''
			})
			setImageUploads(
				variant.images.map(url => ({
					id: crypto.randomUUID(),
					status: 'uploaded' as const,
					publicUrl: url
				}))
			)
		} else {
			reset({
				price: '',
				stock: '0',
				// Seed v_value from the product attribute when adding the first variant
				v_value: !hasExistingVariants && variantTypeAttrValue ? variantTypeAttrValue : null,
				status: 'active',
				vendor_product_sku: '',
				prom_id: '',
				color_id: null,
				weight_g: '',
				promo_percent: '',
				promo_ends_at: ''
			})
			setImageUploads([])
		}
	}, [open, isEdit, variant, reset])

	const buildImageUrls = async (): Promise<string[]> => {
		const pendingFiles = imageUploads
			.filter(img => img.status === 'pending' && img.file)
			.map(img => img.file!)

		const newUrls =
			pendingFiles.length > 0 ? await productsApi.uploadImages(productId, pendingFiles) : []

		let newUrlIdx = 0
		return imageUploads
			.filter(
				img =>
					(img.status === 'uploaded' && img.publicUrl) ||
					(img.status === 'pending' && img.file)
			)
			.map(img => {
				if (img.status === 'uploaded') return img.publicUrl!
				return newUrls[newUrlIdx++]
			})
	}

	const onSubmit = handleSubmit(async values => {
		// Require v_value when product has variants
		if (hasVariants && !values.v_value?.trim()) {
			setError('v_value', { message: "Значення варіанта є обов'язковим" })
			return
		}

		try {
			const images = await buildImageUrls()

			const payload = {
				price: Number(values.price),
				stock: Number(values.stock),
				v_value: hasVariants ? (values.v_value ?? null) : null,
				status: values.status,
				vendor_product_sku: values.vendor_product_sku || undefined,
				prom_id: values.prom_id || undefined,
				images,
				// Sent on every save so clearing the colour actually clears it server-side.
				color_id: hasVariants ? (values.color_id ?? null) : null,
				// Same for the weight: an emptied field must clear it, not keep the old value.
				weight_g: values.weight_g ? Number(values.weight_g) : null,
				// And for the promotion (TD-0012): null clears it; a date only rides with a percent.
				promo_percent: values.promo_percent ? Number(values.promo_percent) : null,
				promo_ends_at:
					values.promo_percent && values.promo_ends_at
						? fromDateTimeLocal(values.promo_ends_at)
						: null
			}

			if (isEdit && variant) {
				await productsApi.updateVariant(productId, variant._id, payload)
				toast.success('Варіант оновлено')
			} else {
				await productsApi.addVariant(productId, payload)
				toast.success('Варіант додано')
			}

			onSuccess()
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Помилка збереження')
		}
	})

	return (
		<Dialog open={open} onOpenChange={open => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<DialogHeader>
					<DialogTitle>{isEdit ? 'Редагувати варіант' : 'Новий варіант'}</DialogTitle>
				</DialogHeader>

				<form onSubmit={onSubmit} className='flex flex-col gap-4'>
					{/* Auto-generated SKU — read-only, only visible when editing */}
					{isEdit && variant && (
						<div className='flex items-center gap-2'>
							<span className='text-xs text-gray-500'>SKU:</span>
							<Badge variant='outline' className='font-mono text-xs'>
								{variant.sku}
							</Badge>
						</div>
					)}

					{/* Variant value — only for products with variants */}
					{hasVariants && (
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='v_value'>Значення варіанта</Label>
							<Input
								id='v_value'
								placeholder='Наприклад: Чорний'
								{...register('v_value')}
								readOnly={isVValueLocked}
								className={isVValueLocked ? 'bg-gray-50 text-gray-500' : undefined}
								aria-invalid={!!errors.v_value}
							/>
							{isVValueLocked && (
								<p className='text-muted-foreground text-xs'>
									Значення береться з атрибута продукту і не може бути змінено
									тут.
								</p>
							)}
							{errors.v_value && (
								<p className='text-destructive text-xs'>{errors.v_value.message}</p>
							)}
						</div>
					)}

					{/* Colour — only meaningful when the product varies by colour. */}
					{hasVariants && (
						<div className='flex flex-col gap-1.5'>
							<Label htmlFor='variant-color'>Колір зі словника</Label>
							<Controller
								control={control}
								name='color_id'
								render={({ field }) => (
									<ColorSelect
										id='variant-color'
										value={field.value ?? null}
										onChange={field.onChange}
									/>
								)}
							/>
							<p className='text-muted-foreground text-xs'>
								Родину кольору проставляє сервер зі словника.
							</p>
						</div>
					)}

					{/* Price / Stock */}
					<div className='flex gap-3'>
						<div className='flex flex-1 flex-col gap-1.5'>
							<Label htmlFor='price'>Ціна (₴)</Label>
							<Input
								id='price'
								type='number'
								min={0}
								step={0.01}
								placeholder='0.00'
								{...register('price')}
								aria-invalid={!!errors.price}
							/>
							{errors.price && (
								<p className='text-destructive text-xs'>{errors.price.message}</p>
							)}
						</div>

						<div className='flex flex-1 flex-col gap-1.5'>
							<Label htmlFor='stock'>Кількість</Label>
							<Input
								id='stock'
								type='number'
								min={0}
								step={1}
								placeholder='0'
								{...register('stock')}
								aria-invalid={!!errors.stock}
							/>
							{errors.stock && (
								<p className='text-destructive text-xs'>{errors.stock.message}</p>
							)}
						</div>

						<div className='flex flex-1 flex-col gap-1.5'>
							<Label htmlFor='weight_g'>Вага для пошти, г</Label>
							<Input
								id='weight_g'
								type='number'
								min={0}
								step={1}
								placeholder='напр. 1220'
								{...register('weight_g')}
								aria-invalid={!!errors.weight_g}
							/>
							{errors.weight_g ? (
								<p className='text-destructive text-xs'>
									{errors.weight_g.message}
								</p>
							) : (
								<p className='text-muted-foreground text-xs'>Посилка з упаковкою</p>
							)}
						</div>
					</div>
					{/* Spans the whole row: in one narrow column this paragraph made the row twice as tall. */}
					<p className='text-muted-foreground -mt-2 text-xs'>
						<span className='text-foreground font-medium'>Вага для пошти</span> — повна
						вага посилки разом з упаковкою; з неї рахується тариф Нової Пошти на
						сторінці товару і shipping_weight у Google-фіді. Атрибути товару (наприклад
						«Вага (кг)») описують сам товар для покупця й на доставку не впливають.
					</p>

					<WeightInfoNote />

					{/* Promotion (TD-0012) */}
					{endedPromo && (
						<p className='text-muted-foreground -mb-2 text-xs'>
							Попередня акція −{endedPromo.promo_percent} % завершилась{' '}
							{formatAdminDateTime(endedPromo.promo_ends_at)}; збереження без відсотка
							прибере її остаточно.
						</p>
					)}
					<div className='flex gap-3'>
						<div className='flex flex-1 flex-col gap-1.5'>
							<Label htmlFor='promo_percent'>Акція, %</Label>
							<Input
								id='promo_percent'
								type='number'
								min={1}
								max={90}
								step={1}
								placeholder='напр. 15'
								{...register('promo_percent')}
								aria-invalid={!!errors.promo_percent}
							/>
							{errors.promo_percent ? (
								<p className='text-destructive text-xs'>
									{errors.promo_percent.message}
								</p>
							) : (
								<p className='text-muted-foreground text-xs'>
									Порожнє поле — акції немає
								</p>
							)}
						</div>
						<div className='flex flex-1 flex-col gap-1.5'>
							<Label htmlFor='promo_ends_at'>Акція до</Label>
							<Input
								id='promo_ends_at'
								type='datetime-local'
								{...register('promo_ends_at')}
								aria-invalid={!!errors.promo_ends_at}
							/>
							{errors.promo_ends_at ? (
								<p className='text-destructive text-xs'>
									{errors.promo_ends_at.message}
								</p>
							) : (
								<p className='text-muted-foreground text-xs'>
									Діє лише разом із відсотком; порожнє — без дати завершення
								</p>
							)}
						</div>
					</div>
					{(supplierPrice != null || previewedSale != null) && (
						<p
							className={
								belowCost
									? 'rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800'
									: 'text-muted-foreground -mt-2 text-xs'
							}
							role={belowCost ? 'status' : undefined}
						>
							{previewedSale != null && <>Акційна ціна: ₴{previewedSale}. </>}
							{supplierPrice != null && <>Закупівля: ₴{supplierPrice}.</>}
							{belowCost && <> Акційна ціна нижча за закупівельну.</>}
						</p>
					)}

					{/* Status */}
					<div className='flex flex-col gap-1.5'>
						<Label>Статус</Label>
						<Controller
							control={control}
							name='status'
							render={({ field }) => (
								<Select value={field.value} onValueChange={field.onChange}>
									<SelectTrigger className='w-48'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='active'>Активний</SelectItem>
										<SelectItem value='draft'>Чернетка</SelectItem>
										<SelectItem value='archived'>Архівний</SelectItem>
									</SelectContent>
								</Select>
							)}
						/>
					</div>

					{/* Vendor Product SKU */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='vendor_product_sku'>Артикул вендора (необов'язково)</Label>
						<Input
							id='vendor_product_sku'
							placeholder='Артикул у системі вендора'
							{...register('vendor_product_sku')}
						/>
					</div>

					{/* Prom product id */}
					<div className='flex flex-col gap-1.5'>
						<Label htmlFor='prom_id'>ID на Промі (необов'язково)</Label>
						<Input
							id='prom_id'
							placeholder='Напр. 3012625429'
							{...register('prom_id')}
						/>
					</div>

					{/* Images */}
					<div className='flex flex-col gap-1.5'>
						<Label>Зображення</Label>
						<ImageDropzone images={imageUploads} onChange={setImageUploads} />
					</div>

					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={onClose}
							disabled={isSubmitting}
						>
							Скасувати
						</Button>
						<Button type='submit' disabled={isSubmitting}>
							{isSubmitting ? 'Збереження...' : isEdit ? 'Зберегти' : 'Додати'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
