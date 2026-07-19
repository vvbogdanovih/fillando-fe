'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Label } from '@/common/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@/common/components/ui/select'
import { categoriesApi } from '../../categories/categories.api'
import { vendorsApi } from '../../vendors/vendors.api'
import type { ProductFormValues } from '../products.schema'

interface CategoryBlockProps {
	control: Control<ProductFormValues>
	errors: FieldErrors<ProductFormValues>
	onCategoryChange?: (categoryId: string) => void
}

export const CategoryBlock = ({ control, errors, onCategoryChange }: CategoryBlockProps) => {
	const { data: categories = [], isLoading } = useQuery({
		queryKey: ['categories'],
		queryFn: () => categoriesApi.getAll()
	})

	const { data: vendors = [], isLoading: isVendorsLoading } = useQuery({
		queryKey: ['vendors'],
		queryFn: () => vendorsApi.getAll()
	})

	return (
		<section className='flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6'>
			<h2 className='text-sm font-semibold text-gray-900'>Категорія та вендор</h2>

			{/* Vendor */}
			<div className='flex flex-col gap-1.5'>
				<Label>Вендор</Label>
				<Controller
					control={control}
					name='vendor_id'
					render={({ field }) => (
						<Select
							value={field.value}
							onValueChange={field.onChange}
							disabled={isVendorsLoading}
						>
							<SelectTrigger className='w-72' aria-invalid={!!errors.vendor_id}>
								<SelectValue
									placeholder={
										isVendorsLoading ? 'Завантаження...' : 'Оберіть вендора'
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{vendors.map(v => (
									<SelectItem key={v._id} value={v._id}>
										{v.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
				{errors.vendor_id && (
					<p className='text-destructive text-xs'>{errors.vendor_id.message}</p>
				)}
			</div>

			{/* Category select */}
			<div className='flex flex-col gap-1.5'>
				<Label>Категорія</Label>
				<Controller
					control={control}
					name='category_id'
					render={({ field }) => (
						<Select
							value={field.value}
							onValueChange={val => {
								field.onChange(val)
								onCategoryChange?.(val)
							}}
							disabled={isLoading}
						>
							<SelectTrigger className='w-72' aria-invalid={!!errors.category_id}>
								<SelectValue
									placeholder={
										isLoading ? 'Завантаження...' : 'Оберіть категорію'
									}
								/>
							</SelectTrigger>
							<SelectContent>
								{categories.map(cat => (
									<SelectItem key={cat._id} value={cat._id}>
										{cat.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				/>
				{errors.category_id && (
					<p className='text-destructive text-xs'>{errors.category_id.message}</p>
				)}
			</div>
		</section>
	)
}
