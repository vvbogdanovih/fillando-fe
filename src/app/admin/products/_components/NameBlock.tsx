'use client'

import { useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form'
import { Input } from '@/common/components/ui/input'
import { Label } from '@/common/components/ui/label'
import { toSlug } from '@/common/utils'
import type { ProductFormValues } from '../products.schema'

interface NameBlockProps {
	control: Control<ProductFormValues>
	errors: FieldErrors<ProductFormValues>
	register: UseFormRegister<ProductFormValues>
}

export const NameBlock = ({ control, errors, register }: NameBlockProps) => {
	const name = useWatch({ control, name: 'name' })
	const slugPreview = toSlug(name ?? '')

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<h2 className='text-sm font-semibold text-gray-900'>Назва</h2>

			<div className='flex flex-col gap-1.5'>
				<Label htmlFor='product-name'>Назва продукту</Label>
				<Input
					id='product-name'
					placeholder='Наприклад: Filament PLA'
					{...register('name')}
					aria-invalid={!!errors.name}
				/>
				{errors.name && <p className='text-destructive text-xs'>{errors.name.message}</p>}
				<p className='text-muted-foreground text-xs'>
					Якщо продукт має варіанти, ця назва використовується як основа — значення
					варіанта додається до неї.
				</p>
			</div>

			<div className='flex flex-col gap-1'>
				<span className='text-xs font-medium text-gray-500'>
					Slug (попередній перегляд)
				</span>
				<span className='font-mono text-xs text-gray-400'>
					{slugPreview || <span className='italic'>буде згенеровано з назви</span>}
				</span>
			</div>
		</section>
	)
}
