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
import { productsApi } from '../products.api'
import {
	variantEditFormSchema,
	type VariantEditFormValues,
	type ProductVariantFull
} from '../products.schema'

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
		formState: { errors, isSubmitting }
	} = useForm<VariantEditFormValues>({
		resolver: zodResolver(variantEditFormSchema)
	})

	// Reset form and images when modal opens or switches variant
	useEffect(() => {
		if (!open) return

		if (isEdit && variant) {
			reset({
				price: String(variant.price),
				stock: String(variant.stock),
				v_value: variant.v_value,
				status: variant.status,
				vendor_product_sku: variant.vendor_product_sku ?? ''
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
				vendor_product_sku: ''
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
				images
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
					</div>

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
