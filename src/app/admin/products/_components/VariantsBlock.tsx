'use client'

import {
	Controller,
	type Control,
	type FieldErrors,
	type UseFormRegister,
	type UseFieldArrayReturn
} from 'react-hook-form'
import { PlusIcon } from 'lucide-react'
import { Label } from '@/common/components/ui/label'
import { Button } from '@/common/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { VariantFieldsCard } from './VariantFieldsCard'
import type { ImageUploadItem } from './ImageDropzone'
import type { ProductFormValues, AttributeItem } from '../products.schema'

interface VariantsBlockProps {
	control: Control<ProductFormValues>
	register: UseFormRegister<ProductFormValues>
	errors: FieldErrors<ProductFormValues>
	fieldArray: UseFieldArrayReturn<ProductFormValues, 'variants'>
	hasVariants: boolean
	variantTypeKey: string | null
	/** When true, the first variant card's v_value is locked (synced from the attribute) */
	isFirstVariantLocked?: boolean
	productName: string
	attributes: AttributeItem[]
	variantImageUploads: ImageUploadItem[][]
	onImagesChange: (variantIndex: number, images: ImageUploadItem[]) => void
	onAddVariant: () => void
	onRemoveVariant: (index: number) => void
}

export const VariantsBlock = ({
	control,
	register,
	errors,
	fieldArray,
	hasVariants,
	variantTypeKey,
	isFirstVariantLocked,
	productName,
	attributes,
	variantImageUploads,
	onImagesChange,
	onAddVariant,
	onRemoveVariant
}: VariantsBlockProps) => {
	const { fields } = fieldArray

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<div className='flex items-center gap-3'>
				<Controller
					control={control}
					name='has_variants'
					render={({ field }) => (
						<input
							id='has_variants'
							type='checkbox'
							checked={field.value}
							onChange={field.onChange}
							className='accent-primary size-4 cursor-pointer'
						/>
					)}
				/>
				<Label htmlFor='has_variants' className='cursor-pointer'>
					Продукт має варіанти
				</Label>
			</div>

			{hasVariants && (
				<div className='flex flex-col gap-1.5'>
					<Label>Ознака варіативності</Label>
					<Controller
						control={control}
						name='variant_type_key'
						render={({ field }) => (
							<Select
								value={field.value ?? ''}
								onValueChange={field.onChange}
								disabled={attributes.length === 0}
							>
								<SelectTrigger
									className='w-72'
									aria-invalid={!!errors.variant_type_key}
								>
									<SelectValue
										placeholder={
											attributes.length === 0
												? 'Спочатку додайте атрибути'
												: 'Оберіть атрибут'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{attributes.map(attr => (
										<SelectItem key={attr.k} value={attr.k}>
											{attr.l}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
					{errors.variant_type_key && (
						<p className='text-destructive text-xs'>
							{errors.variant_type_key.message}
						</p>
					)}
				</div>
			)}

			{/* Variant cards */}
			<div className='flex flex-col gap-4'>
				{fields.map((field, index) => (
					<VariantFieldsCard
						key={field.id}
						index={index}
						control={control}
						register={register}
						errors={errors}
						hasVariants={hasVariants}
						isVValueLocked={index === 0 && !!isFirstVariantLocked}
						productName={productName}
						imageUploads={variantImageUploads[index] ?? []}
						onImagesChange={imgs => onImagesChange(index, imgs)}
						onRemove={() => onRemoveVariant(index)}
						canRemove={fields.length > 1}
					/>
				))}
			</div>

			{hasVariants && variantTypeKey && (
				<Button
					type='button'
					variant='outline'
					size='sm'
					className='w-fit'
					onClick={onAddVariant}
				>
					<PlusIcon className='size-4' />
					Додати варіант
				</Button>
			)}
		</section>
	)
}
