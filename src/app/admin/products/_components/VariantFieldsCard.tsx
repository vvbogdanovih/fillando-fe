'use client'

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { XIcon } from 'lucide-react'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { Button } from '@/common/components/ui/button'
import { toSlug } from '@/common/utils'
import { ImageDropzone, type ImageUploadItem } from './ImageDropzone'
import type { ProductFormValues } from '../products.schema'

interface VariantFieldsCardProps {
	index: number
	control: Control<ProductFormValues>
	register: UseFormRegister<ProductFormValues>
	errors: FieldErrors<ProductFormValues>
	hasVariants: boolean
	/** When true, the v_value field is read-only — its value is synced from the attribute */
	isVValueLocked?: boolean
	productName: string
	imageUploads: ImageUploadItem[]
	onImagesChange: (images: ImageUploadItem[]) => void
	onRemove?: () => void
	canRemove: boolean
}

export const VariantFieldsCard = ({
	index,
	control,
	register,
	errors,
	hasVariants,
	isVValueLocked,
	productName,
	imageUploads,
	onImagesChange,
	onRemove,
	canRemove
}: VariantFieldsCardProps) => {
	const vValue = useWatch({ control, name: `variants.${index}.v_value` }) ?? ''
	const variantSlug = hasVariants ? toSlug(`${productName} ${vValue}`) : toSlug(productName)

	const variantErrors = errors.variants?.[index]

	return (
		<div className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			{/* Card header */}
			<div className='flex items-center justify-between'>
				<h3 className='text-sm font-semibold text-gray-900'>
					{hasVariants ? `Варіант ${index + 1}` : 'Ціна та Наявність'}
				</h3>
				{hasVariants && canRemove && (
					<Button type='button' size='icon-sm' variant='ghost' onClick={onRemove}>
						<XIcon className='size-4' />
					</Button>
				)}
			</div>

			{/* v_value + slug preview — only when has_variants */}
			{hasVariants && (
				<div className='flex flex-col gap-1.5'>
					<Label htmlFor={`v_value_${index}`}>Значення варіанта</Label>
					<Input
						id={`v_value_${index}`}
						placeholder='Наприклад: Чорний'
						{...register(`variants.${index}.v_value`)}
						readOnly={isVValueLocked}
						className={isVValueLocked ? 'bg-gray-50 text-gray-500' : undefined}
						aria-invalid={!!variantErrors?.v_value}
					/>
					{isVValueLocked && (
						<p className='text-muted-foreground text-xs'>
							Значення береться з атрибута продукту і не може бути змінено тут.
						</p>
					)}
					{variantErrors?.v_value && (
						<p className='text-destructive text-xs'>{variantErrors.v_value.message}</p>
					)}
					<span className='font-mono text-xs text-gray-400'>
						{variantSlug || (
							<span className='text-gray-300 italic'>slug буде згенеровано</span>
						)}
					</span>
				</div>
			)}

			{/* Price / Stock */}
			<div className='flex gap-4'>
				<div className='flex flex-1 flex-col gap-1.5'>
					<Label htmlFor={`price_${index}`}>Ціна (₴)</Label>
					<Input
						id={`price_${index}`}
						type='number'
						min={0}
						step={0.01}
						placeholder='0.00'
						{...register(`variants.${index}.price`)}
						aria-invalid={!!variantErrors?.price}
					/>
					{variantErrors?.price && (
						<p className='text-destructive text-xs'>{variantErrors.price.message}</p>
					)}
				</div>

				<div className='flex flex-1 flex-col gap-1.5'>
					<Label htmlFor={`stock_${index}`}>Кількість</Label>
					<Input
						id={`stock_${index}`}
						type='number'
						min={0}
						step={1}
						placeholder='0'
						{...register(`variants.${index}.stock`)}
						aria-invalid={!!variantErrors?.stock}
					/>
					{variantErrors?.stock && (
						<p className='text-destructive text-xs'>{variantErrors.stock.message}</p>
					)}
				</div>

				<div className='flex flex-1 flex-col gap-1.5'>
					<Label htmlFor={`vendor_product_sku_${index}`}>Артикул вендора</Label>
					<Input
						id={`vendor_product_sku_${index}`}
						placeholder="Необов'язково"
						{...register(`variants.${index}.vendor_product_sku`)}
					/>
				</div>
			</div>

			{/* Images */}
			<div className='flex flex-col gap-1.5'>
				<Label>Зображення</Label>
				<ImageDropzone images={imageUploads} onChange={onImagesChange} />
			</div>
		</div>
	)
}
